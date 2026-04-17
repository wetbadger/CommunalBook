import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAuthStore } from '../../src/stores/auth';
import axios from 'axios';

vi.mock('axios');

describe('Auth Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should initialize with no user', () => {
    const store = useAuthStore();
    expect(store.isAuthenticated).toBe(false);
    expect(store.currentUser).toBe(null);
  });

  it('should login user successfully', async () => {
    const mockResponse = {
      data: {
        token: 'test-token',
        user: { id: '1', username: 'testuser', deleteCredits: 0, wordsWritten: 0 }
      }
    };
    
    axios.post.mockResolvedValue(mockResponse);
    
    const store = useAuthStore();
    const result = await store.login('testuser', 'password');
    
    expect(result.success).toBe(true);
    expect(store.isAuthenticated).toBe(true);
    expect(store.token).toBe('test-token');
    expect(localStorage.getItem('token')).toBe('test-token');
  });

  it('should handle login failure', async () => {
    axios.post.mockRejectedValue({
      response: { data: { message: 'Invalid credentials' } }
    });
    
    const store = useAuthStore();
    const result = await store.login('wronguser', 'wrongpass');
    
    expect(result.success).toBe(false);
    expect(result.message).toBe('Invalid credentials');
    expect(store.isAuthenticated).toBe(false);
  });

  it('should register user successfully', async () => {
    const mockResponse = {
      data: {
        token: 'new-token',
        user: { id: '2', username: 'newuser', deleteCredits: 0, wordsWritten: 0 }
      }
    };
    
    axios.post.mockResolvedValue(mockResponse);
    
    const store = useAuthStore();
    const result = await store.register('newuser', 'password');
    
    expect(result.success).toBe(true);
    expect(store.isAuthenticated).toBe(true);
  });

  it('should logout user', () => {
    const store = useAuthStore();
    store.setAuth('test-token', { id: '1', username: 'testuser' });
    
    expect(store.isAuthenticated).toBe(true);
    
    store.logout();
    
    expect(store.isAuthenticated).toBe(false);
    expect(store.token).toBe(null);
    expect(localStorage.getItem('token')).toBe(null);
  });
});