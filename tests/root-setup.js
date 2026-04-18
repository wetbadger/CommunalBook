// tests/root-setup.js
import { vi } from 'vitest';

// Detect environment based on test file path
const testFile = expect.getState().testPath || '';

// Setup localStorage mock for ALL environments (since frontend tests need it)
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  clear: vi.fn(),
  removeItem: vi.fn(),
  length: 0,
  key: vi.fn()
};

global.localStorage = localStorageMock;
global.sessionStorage = { ...localStorageMock };

if (testFile.includes('frontend')) {
  // Setup frontend (jsdom) environment
  if (typeof window !== 'undefined') {
    // Mock window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    
    // Mock IntersectionObserver
    global.IntersectionObserver = class IntersectionObserver {
      constructor(callback) {
        this.callback = callback;
      }
      observe() { return null; }
      unobserve() { return null; }
      disconnect() { return null; }
    };
    
    // Mock ResizeObserver
    global.ResizeObserver = class ResizeObserver {
      constructor(callback) {
        this.callback = callback;
      }
      observe() { return null; }
      unobserve() { return null; }
      disconnect() { return null; }
    };
  }
  
  // Frontend-specific mocks
  vi.mock('socket.io-client', () => ({
    io: vi.fn(() => ({
      on: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn(),
      connect: vi.fn()
    }))
  }));
  
  vi.mock('axios', () => ({
    default: {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      defaults: {
        headers: {
          common: {}
        }
      },
      interceptors: {
        request: {
          use: vi.fn(),
          eject: vi.fn()
        },
        response: {
          use: vi.fn(),
          eject: vi.fn()
        }
      },
      create: vi.fn(() => ({
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() }
        }
      }))
    }
  }));
  
  vi.mock('vue-router', () => ({
    useRouter: vi.fn(() => ({
      push: vi.fn(),
      replace: vi.fn(),
      go: vi.fn(),
      back: vi.fn()
    })),
    useRoute: vi.fn(() => ({
      params: {},
      query: {},
      path: '/'
    }))
  }));
  
} else if (testFile.includes('backend')) {
  // Setup backend (node) environment
  
  // Mock mongoose FIRST before any imports
  vi.mock('mongoose', async () => {
    const mockQuery = {
      populate: vi.fn().mockReturnThis(),
      lean: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis()
    };

    const mockModel = {
      find: vi.fn(() => mockQuery),
      findById: vi.fn(() => mockQuery),
      findOne: vi.fn(() => mockQuery),
      findByIdAndUpdate: vi.fn(() => mockQuery),
      findOneAndUpdate: vi.fn(() => mockQuery),
      countDocuments: vi.fn().mockResolvedValue(0),
      deleteMany: vi.fn().mockResolvedValue({ deletedCount: 0 }),
      create: vi.fn(),
      save: vi.fn(),
      prototype: {
        save: vi.fn(),
        deleteOne: vi.fn()
      }
    };

    const Schema = vi.fn((definition) => {
      const schema = { ...mockModel };
      schema.index = vi.fn();
      schema.pre = vi.fn();
      schema.method = vi.fn();
      schema.virtual = vi.fn(() => ({
        get: vi.fn(),
        set: vi.fn()
      }));
      schema.Types = {
        ObjectId: String,
        String: String,
        Number: Number,
        Date: Date
      };
      return schema;
    });

    Schema.Types = {
      ObjectId: String,
      String: String,
      Number: Number,
      Date: Date
    };

    return {
      default: {
        connect: vi.fn().mockResolvedValue({}),
        connection: {
          on: vi.fn(),
          once: vi.fn(),
          close: vi.fn(),
          readyState: 1
        },
        Schema,
        model: vi.fn((name, schema) => ({
          ...mockModel,
          name,
          schema
        })),
        Types: {
          ObjectId: String,
          String: String,
          Number: Number,
          Date: Date,
          Boolean: Boolean
        },
        isValidObjectId: vi.fn(() => true)
      },
      Schema,
      model: vi.fn(),
      Types: {
        ObjectId: String
      }
    };
  });

  // Mock bcryptjs
  vi.mock('bcryptjs', () => ({
    default: {
      genSalt: vi.fn().mockResolvedValue('salt'),
      hash: vi.fn().mockResolvedValue('hashedpassword'),
      compare: vi.fn().mockResolvedValue(true)
    },
    genSalt: vi.fn().mockResolvedValue('salt'),
    hash: vi.fn().mockResolvedValue('hashedpassword'),
    compare: vi.fn().mockResolvedValue(true)
  }));

  // Mock jsonwebtoken
  vi.mock('jsonwebtoken', () => ({
    default: {
      sign: vi.fn(() => 'mock-token'),
      verify: vi.fn((token, secret, callback) => {
        callback(null, { userId: 'test-user-id', username: 'testuser' });
      })
    },
    sign: vi.fn(() => 'mock-token'),
    verify: vi.fn()
  }));

  // Mock dotenv
  vi.mock('dotenv', () => ({
    default: {
      config: vi.fn()
    },
    config: vi.fn()
  }));

  // Mock node-cron
  vi.mock('node-cron', () => ({
    default: {
      schedule: vi.fn()
    },
    schedule: vi.fn()
  }));

  // Set environment variables for backend tests
  process.env.JWT_SECRET = 'test-secret-key';
  process.env.MONGODB_URI = 'mongodb://localhost:27017/test-db';
  process.env.NODE_ENV = 'test';
  process.env.PORT = '3001';
}