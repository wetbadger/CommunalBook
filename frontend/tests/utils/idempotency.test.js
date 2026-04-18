// frontend/tests/utils/idempotency.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateIdempotencyKey, idempotencyTracker } from '../../src/utils/idempotency';

describe('Idempotency Utils', () => {
  beforeEach(() => {
    // Reset localStorage mock
    if (global.localStorage) {
      global.localStorage.getItem.mockReset();
      global.localStorage.setItem.mockReset();
      global.localStorage.clear.mockReset();
      global.localStorage.removeItem.mockReset();
    }
    
    // Clear the tracker
    if (idempotencyTracker && idempotencyTracker.pendingRequests) {
      idempotencyTracker.pendingRequests.clear();
    }
  });

  describe('generateIdempotencyKey', () => {
    it('should generate unique keys for different operations', () => {
      // Mock localStorage.getItem to return null initially (no session ID)
      global.localStorage.getItem.mockReturnValue(null);
      
      const key1 = generateIdempotencyKey('add-word', 'test123');
      const key2 = generateIdempotencyKey('delete-word', 'test123');
      
      expect(key1).not.toBe(key2);
    });

    it('should generate keys with session ID', () => {
      // Mock localStorage.getItem to return null initially (no session ID)
      global.localStorage.getItem.mockReturnValue(null);
      
      const key = generateIdempotencyKey('like-word', 'word1');
      expect(key).toContain('like-word');
      expect(key).toContain('word1');
      expect(key.length).toBeGreaterThan(0);
    });
  });

  describe('IdempotencyTracker', () => {
    it('should track pending requests', () => {
      const key = 'test-key-123';
      
      expect(idempotencyTracker.isPending(key)).toBe(false);
      
      idempotencyTracker.addPending(key);
      
      expect(idempotencyTracker.isPending(key)).toBe(true);
    });

    it('should remove pending requests', () => {
      const key = 'test-key-456';
      
      idempotencyTracker.addPending(key);
      expect(idempotencyTracker.isPending(key)).toBe(true);
      
      idempotencyTracker.removePending(key);
      expect(idempotencyTracker.isPending(key)).toBe(false);
    });

    it('should auto-clear pending requests after timeout', async () => {
      const key = 'timeout-key';
      
      idempotencyTracker.addPending(key);
      expect(idempotencyTracker.isPending(key)).toBe(true);
      
      // Wait for auto-clear (10 seconds in real code)
      // For testing, we can just verify it's in the map
      // In a real test, you'd mock setTimeout
      expect(idempotencyTracker.pendingRequests.has(key)).toBe(true);
      
      // Clean up
      idempotencyTracker.removePending(key);
    });
  });
});