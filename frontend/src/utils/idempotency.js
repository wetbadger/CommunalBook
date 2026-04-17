// frontend/src/utils/idempotency.js

/**
 * Generates a unique idempotency key for requests
 * @param {string} operation - The operation type (e.g., 'delete-word', 'add-word', 'like-word')
 * @param {string} id - The resource ID or position
 * @returns {string} Unique idempotency key
 */
export const generateIdempotencyKey = (operation, id) => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const sessionId = localStorage.getItem('sessionId') || generateSessionId();
  
  return `${sessionId}-${operation}-${id}-${timestamp}-${random}`;
};

/**
 * Generate a persistent session ID for this browser tab
 */
const generateSessionId = () => {
  const sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  localStorage.setItem('sessionId', sessionId);
  return sessionId;
};

/**
 * Store for tracking in-flight requests to prevent duplicates at UI level
 */
class IdempotencyTracker {
  constructor() {
    this.pendingRequests = new Map();
  }
  
  isPending(key) {
    return this.pendingRequests.has(key);
  }
  
  addPending(key) {
    this.pendingRequests.set(key, true);
    // Auto-clear after 10 seconds (in case something goes wrong)
    setTimeout(() => {
      this.pendingRequests.delete(key);
    }, 10000);
  }
  
  removePending(key) {
    this.pendingRequests.delete(key);
  }
}

export const idempotencyTracker = new IdempotencyTracker();
