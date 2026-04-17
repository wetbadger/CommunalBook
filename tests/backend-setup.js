import { vi } from 'vitest';

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

// Set environment variables
process.env.JWT_SECRET = 'test-secret-key';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test-db';
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';

// Mock console methods to keep test output clean
global.console = {
  ...console,
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn()
};