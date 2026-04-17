// backend/middleware/idempotency.js
import crypto from 'crypto';

// Store for idempotency keys (use Redis in production)
const idempotencyStore = new Map();

// Clean up old entries every hour
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of idempotencyStore.entries()) {
    if (now - entry.timestamp > 300000) { // 5 minutes
      idempotencyStore.delete(key);
    }
  }
}, 3600000); // Run every hour

export const idempotencyMiddleware = (req, res, next) => {
  // Only apply to state-changing methods
  const stateChangingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (!stateChangingMethods.includes(req.method)) {
    return next();
  }
  
  // Get idempotency key from header
  let idempotencyKey = req.headers['idempotency-key'];
  
  // Auto-generate key for DELETE requests if not provided (optional)
  if (!idempotencyKey && req.method === 'DELETE') {
    // Create a key based on user + path + body
    const hashInput = `${req.user?.userId || 'anonymous'}:${req.path}:${JSON.stringify(req.body)}:${req.params.position}`;
    idempotencyKey = crypto.createHash('sha256').update(hashInput).digest('hex');
    req.headers['idempotency-key'] = idempotencyKey;
  }
  
  if (!idempotencyKey) {
    return next();
  }
  
  // Check if this request has been processed before
  const existingResponse = idempotencyStore.get(idempotencyKey);
  
  if (existingResponse) {
    console.log(`🔄 Idempotent request detected: ${idempotencyKey}`);
    // Return the cached response
    return res.status(existingResponse.status).json(existingResponse.data);
  }
  
  // Store that this request is being processed
  idempotencyStore.set(idempotencyKey, {
    status: 'processing',
    timestamp: Date.now()
  });
  
  // Capture the original send/json methods
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);
  
  // Override json method
  res.json = function(data) {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      // Store successful response
      idempotencyStore.set(idempotencyKey, {
        status: res.statusCode,
        data: data,
        timestamp: Date.now()
      });
    } else if (res.statusCode >= 400) {
      // Remove processing marker for errors so client can retry
      idempotencyStore.delete(idempotencyKey);
    }
    originalJson(data);
  };
  
  // Override send method (for non-JSON responses)
  res.send = function(data) {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      idempotencyStore.set(idempotencyKey, {
        status: res.statusCode,
        data: data,
        timestamp: Date.now()
      });
    } else if (res.statusCode >= 400) {
      idempotencyStore.delete(idempotencyKey);
    }
    originalSend(data);
  };
  
  next();
};