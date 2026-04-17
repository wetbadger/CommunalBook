// frontend/src/plugins/axios.js
import axios from 'axios';
import { generateIdempotencyKey, idempotencyTracker } from '../utils/idempotency';

// Auto-add idempotency keys to all state-changing requests
axios.interceptors.request.use(config => {
  // Only add to state-changing methods
  const stateChangingMethods = ['post', 'put', 'patch', 'delete'];
  
  if (stateChangingMethods.includes(config.method?.toLowerCase())) {
    // Skip if idempotency key already exists
    if (!config.headers['Idempotency-Key']) {
      // Generate a key based on method, URL, and body
      const keyData = `${config.method}:${config.url}:${JSON.stringify(config.data || {})}`;
      const idempotencyKey = generateIdempotencyKey('auto', Buffer.from(keyData).toString('base64').substring(0, 50));
      config.headers['Idempotency-Key'] = idempotencyKey;
    }
  }
  
  return config;
});

// Handle idempotency responses
axios.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 409) {
      console.warn('Idempotency conflict:', error.response.data);
      // You could show a user-friendly message here
    }
    return Promise.reject(error);
  }
);