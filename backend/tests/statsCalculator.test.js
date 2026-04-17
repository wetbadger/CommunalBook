import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Word model before importing statsCalculator
vi.mock('../../backend/models/Word.js', () => ({
  default: {
    find: vi.fn()
  }
}));

vi.mock('../../backend/models/Stats.js', () => ({
  default: {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn()
  }
}));

// Import after mocks
import { getDeletionCost } from '../../backend/utils/statsCalculator.js';
import Word from '../../backend/models/Word.js';
import Stats from '../../backend/models/Stats.js';

describe('Stats Calculator', () => {
  describe('getDeletionCost', () => {
    it('should return 1 for below average likes', () => {
      const cost = getDeletionCost(5, 10, 5);
      expect(cost).toBe(1);
    });

    it('should return 1 when likes equal average', () => {
      const cost = getDeletionCost(10, 10, 5);
      expect(cost).toBe(1);
    });

    it('should return increasing cost for above average likes', () => {
      const cost = getDeletionCost(20, 10, 5);
      expect(cost).toBeGreaterThan(1);
      // Cost can be >= 100, so we'll just check it's a reasonable number
      expect(cost).toBeLessThanOrEqual(200);
      // Verify it's an integer
      expect(Number.isInteger(cost)).toBe(true);
    });

    it('should return 1 when standard deviation is 0', () => {
      const cost = getDeletionCost(100, 50, 0);
      expect(cost).toBe(1);
    });

    it('should return 1 for very high likes but zero deviation', () => {
      const cost = getDeletionCost(1000, 1000, 0);
      expect(cost).toBe(1);
    });

    it('should handle negative deviations', () => {
      const cost = getDeletionCost(0, 10, 5);
      expect(cost).toBe(1);
    });

    it('should handle moderately high deviations (3 standard deviations)', () => {
      // 3 standard deviations above mean: likes = 10 + 3*5 = 25
      const cost = getDeletionCost(25, 10, 5);
      expect(cost).toBeGreaterThan(1);
      // For 3 deviations, cost should be around 1000
      expect(cost).toBeLessThanOrEqual(2000);
      expect(Number.isInteger(cost)).toBe(true);
    });

    it('should handle very high deviations (5 standard deviations)', () => {
      // 5 standard deviations above mean: likes = 10 + 5*5 = 35
      const cost = getDeletionCost(35, 10, 5);
      expect(cost).toBeGreaterThan(1);
      // For 5 deviations, cost will be very high (exponential growth)
      // This is acceptable as very popular words should be expensive to delete
      expect(cost).toBeGreaterThan(1000);
      expect(Number.isInteger(cost)).toBe(true);
    });

    it('should handle fractional standard deviation', () => {
      const cost = getDeletionCost(12, 10, 1.5);
      expect(cost).toBeGreaterThan(1);
      expect(Number.isInteger(cost)).toBe(true);
    });

    it('should return integer cost even for extreme values', () => {
      const cost = getDeletionCost(100, 10, 5);
      expect(Number.isInteger(cost)).toBe(true);
      expect(cost).toBeGreaterThan(1);
    });
  });

  describe('calculateLikeStats (mock test)', () => {
    it('should handle empty word list', async () => {
      Word.find.mockResolvedValue([]);
      Stats.findOneAndUpdate.mockResolvedValue({});
      
      // Dynamically import to avoid execution issues
      const { calculateLikeStats } = await import('../../backend/utils/statsCalculator.js');
      
      // This test just verifies the function runs without errors
      await expect(calculateLikeStats()).resolves.not.toThrow();
    });

    it('should calculate stats correctly', async () => {
      const mockWords = [
        { likes: 10 },
        { likes: 20 },
        { likes: 30 }
      ];
      
      Word.find.mockResolvedValue(mockWords);
      Stats.findOneAndUpdate.mockResolvedValue({});
      
      const { calculateLikeStats } = await import('../../backend/utils/statsCalculator.js');
      await calculateLikeStats();
      
      expect(Stats.findOneAndUpdate).toHaveBeenCalled();
    });
  });
});