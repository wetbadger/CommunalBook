import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the User model
vi.mock('../../backend/models/User.js', () => ({
  default: class MockUser {
    constructor(data) {
      this.username = data.username;
      this.password = data.password;
      this.wordsWritten = 0;
      this.deleteCredits = 0;
      this._id = 'mock-user-id';
      this.createdAt = new Date();
    }
    async save() {
      return this;
    }
    async comparePassword(candidate) {
      // For testing, accept 'password123' as valid password
      return candidate === 'password123' || candidate === this.password;
    }
    static async findOne(query) {
      if (query.username === 'existinguser') {
        return new MockUser({ username: 'existinguser', password: 'password123' });
      }
      if (query.username === 'testuser') {
        const user = new MockUser({ username: 'testuser', password: 'password123' });
        return user;
      }
      return null;
    }
  }
}));

// Mock jsonwebtoken
vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(() => 'mock-jwt-token'),
    verify: vi.fn((token, secret, cb) => {
      cb(null, { userId: 'user123', username: 'testuser' });
    })
  }
}));

// Import after mocks
import request from 'supertest';
import express from 'express';
import authRoutes from '../../backend/routes/auth.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Auth Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ username: 'newuser', password: 'password123' });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.username).toBe('newuser');
    });

    it('should return error if username already exists', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ username: 'existinguser', password: 'password123' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Username already exists');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'testuser', password: 'password123' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.username).toBe('testuser');
    });

    it('should return error for invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'nonexistent', password: 'wrong' });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid credentials');
    });
  });
});