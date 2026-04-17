import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useBookStore } from '../../src/stores/book';
import axios from 'axios';

vi.mock('axios');

describe('Book Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('should load book successfully', async () => {
    const mockWords = [
      { _id: '1', text: 'Hello', author: 'user1', authorName: 'testuser', likes: 0 },
      { _id: '2', text: 'World', author: 'user1', authorName: 'testuser', likes: 0 }
    ];
    
    axios.get.mockResolvedValue({ data: mockWords });
    
    const store = useBookStore();
    await store.loadInitialBook();
    
    expect(store.words.length).toBe(2);
    expect(store.bookText).toBe('Hello World');
    expect(store.wordCount).toBe(2);
  });

  it('should add word successfully', async () => {
    const mockWord = { _id: '3', text: 'New', author: 'user1', authorName: 'testuser', likes: 0 };
    
    axios.post.mockResolvedValue({ data: mockWord });
    
    const store = useBookStore();
    store.words = [{ _id: '1', text: 'Hello' }];
    store.authStore = { currentUser: { id: 'user1', username: 'testuser' } };
    
    const result = await store.addWord('New');
    
    expect(result.success).toBe(true);
    expect(store.words.length).toBe(2);
  });

  it('should delete word successfully', async () => {
    const store = useBookStore();
    store.words = [
      { _id: '1', text: 'Hello', author: 'user1' },
      { _id: '2', text: 'World', author: 'user1' }
    ];
    
    axios.delete.mockResolvedValue({ data: { remainingCredits: 5, cost: 1 } });
    
    const result = await store.deleteWordById('1');
    
    expect(result.success).toBe(true);
    expect(store.words.length).toBe(1);
    expect(store.words[0]._id).toBe('2');
  });

  it('should like word successfully', async () => {
    const store = useBookStore();
    store.words = [
      { _id: '1', text: 'Hello', likes: 0, userLiked: false }
    ];
    
    axios.post.mockResolvedValue({ data: { likes: 1, liked: true } });
    
    const result = await store.likeWord('1');
    
    expect(result.success).toBe(true);
    expect(store.words[0].likes).toBe(1);
    expect(store.words[0].userLiked).toBe(true);
  });

  it('should unlike word successfully', async () => {
    const store = useBookStore();
    store.words = [
      { _id: '1', text: 'Hello', likes: 1, userLiked: true }
    ];
    
    axios.delete.mockResolvedValue({ data: { likes: 0, liked: false } });
    
    const result = await store.unlikeWord('1');
    
    expect(result.success).toBe(true);
    expect(store.words[0].likes).toBe(0);
    expect(store.words[0].userLiked).toBe(false);
  });

  it('should sync incrementally', async () => {
    const serverWords = [
      { _id: '1', text: 'Hello', prevWord: null, nextWord: '2', likes: 5 },
      { _id: '2', text: 'World', prevWord: '1', nextWord: null, likes: 3 }
    ];
    
    axios.get.mockResolvedValue({ data: serverWords });
    
    const store = useBookStore();
    store.words = [{ _id: '1', text: 'Hello', likes: 0 }];
    
    await store.syncIncremental();
    
    expect(store.words.length).toBe(2);
    expect(store.words[0].likes).toBe(5);
  });
});