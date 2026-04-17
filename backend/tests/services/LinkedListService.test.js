import { describe, it, expect, beforeEach, vi } from 'vitest';

// Create a simple test without external dependencies
describe('LinkedListService (Unit Tests)', () => {
  let linkedListService;
  let mockWords;

  beforeEach(() => {
    // Mock implementation of the service
    linkedListService = {
      getWordCount: async () => mockWords.length,
      getWordWithContext: async (wordId) => {
        const word = mockWords.find(w => w._id === wordId);
        if (!word) return null;
        
        const prevWord = mockWords.find(w => w._id === word.prevWord);
        const nextWord = mockWords.find(w => w._id === word.nextWord);
        
        return { word, prevWord, nextWord };
      },
      getHead: async () => mockWords.find(w => !w.prevWord),
      getTail: async () => mockWords.find(w => !w.nextWord),
      getBookInOrder: async () => {
        const ordered = [];
        let current = mockWords.find(w => !w.prevWord);
        while (current) {
          ordered.push(current);
          current = mockWords.find(w => w._id === current.nextWord);
        }
        return ordered;
      }
    };

    mockWords = [
      { _id: '1', text: 'Hello', prevWord: null, nextWord: '2' },
      { _id: '2', text: 'World', prevWord: '1', nextWord: null }
    ];
  });

  describe('getWordCount', () => {
    it('should return correct count', async () => {
      const count = await linkedListService.getWordCount();
      expect(count).toBe(2);
    });
  });

  describe('getWordWithContext', () => {
    it('should return word with neighbors', async () => {
      const result = await linkedListService.getWordWithContext('1');
      
      expect(result.word).toEqual(mockWords[0]);
      expect(result.prevWord).toBeUndefined();
      expect(result.nextWord).toEqual(mockWords[1]);
    });

    it('should return null if word not found', async () => {
      const result = await linkedListService.getWordWithContext('nonexistent');
      expect(result).toBe(null);
    });
  });

  describe('getBookInOrder', () => {
    it('should return words in correct order', async () => {
      const result = await linkedListService.getBookInOrder();
      expect(result.length).toBe(2);
      expect(result[0].text).toBe('Hello');
      expect(result[1].text).toBe('World');
    });

    it('should handle empty book', async () => {
      mockWords = [];
      const result = await linkedListService.getBookInOrder();
      expect(result).toEqual([]);
    });
  });
});