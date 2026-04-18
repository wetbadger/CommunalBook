import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import bookRoutes from '../../backend/routes/book.js';
import { authenticateToken } from '../../backend/middleware/auth.js';

// Mock the auth middleware
vi.mock('../../backend/middleware/auth.js', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { userId: 'testuser123', username: 'testuser' };
    next();
  }
}));

const app = express();
app.use(express.json());
app.use('/api/book', bookRoutes);

describe('Book Flow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle complete word lifecycle', async () => {
    // Add a word
    const addResponse = await request(app)
      .post('/api/book/words')
      .send({ text: 'Hello' });
    
    expect(addResponse.status).toBe(201);
    const wordId = addResponse.body._id;
    
    // Like the word
    const likeResponse = await request(app)
      .post(`/api/book/words/${wordId}/like`);
    
    expect(likeResponse.status).toBe(200);
    expect(likeResponse.body.likes).toBe(1);
    
    // Get all words
    const getResponse = await request(app)
      .get('/api/book/words');
    
    expect(getResponse.status).toBe(200);
    expect(getResponse.body.length).toBeGreaterThan(0);
  });
});