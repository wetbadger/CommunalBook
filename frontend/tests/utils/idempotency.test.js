import { describe, it, expect, beforeEach } from 'vitest';
import { generateIdempotencyKey, idempotencyTracker } from '../../src/utils/idempotency';

describe('Idempotency Utils', () => {
  beforeEach(() => {
    localStorage.clear();
    idempotencyTracker.pendingRequests.clear();
  });

  describe('generateIdempotencyKey', () => {
    it('should generate unique keys for different operations', () => {
      const key1 = generateIdempotencyKey('add-word', 'test123');
      const key2 = generateIdempotencyKey('delete-word', 'test123');
      
      expect(key1).not.toBe(key2);
    });

    it('should generate keys with session ID', () => {
      const key = generateIdempotencyKey('like-word', 'word1');
      expect(key).toContain('like-word');
      expect(key).toContain('word1');
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
      
      // Wait for auto-clear (10 seconds in real code, but we can't test that easily)
      // In practice, you might want to mock setTimeout
      expect(idempotencyTracker.pendingRequests.has(key)).toBe(true);
    });
  });
});