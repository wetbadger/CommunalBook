import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock jsonwebtoken
vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn()
  }
}));

// Import using correct path (relative from test file)
import { authenticateToken } from '../../../backend/middleware/auth.js';
import jwt from 'jsonwebtoken';

describe('Auth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      headers: {}
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    next = vi.fn();
  });

  it('should return 401 if no token provided', () => {
    authenticateToken(req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Access token required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 403 if token is invalid', () => {
    req.headers['authorization'] = 'Bearer invalidtoken';
    jwt.verify.mockImplementation((token, secret, callback) => {
      callback(new Error('Invalid token'), null);
    });

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid or expired token' });
  });

  it('should call next if token is valid', () => {
    req.headers['authorization'] = 'Bearer validtoken';
    const user = { userId: '123', username: 'testuser' };
    
    jwt.verify.mockImplementation((token, secret, callback) => {
      callback(null, user);
    });

    authenticateToken(req, res, next);

    expect(req.user).toEqual(user);
    expect(next).toHaveBeenCalled();
  });
});