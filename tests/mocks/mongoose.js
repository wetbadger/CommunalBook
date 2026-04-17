// Complete mock for mongoose
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

const mockSchema = vi.fn((schema) => {
  const schemaObj = {
    ...mockModel,
    index: vi.fn(),
    pre: vi.fn(),
    method: vi.fn(),
    virtual: vi.fn(() => ({
      get: vi.fn(),
      set: vi.fn()
    }))
  };
  
  // Add schema types
  schemaObj.Types = {
    ObjectId: String,
    String: String,
    Number: Number,
    Date: Date,
    Boolean: Boolean
  };
  
  return schemaObj;
});

// Add Types to mockSchema
mockSchema.Types = {
  ObjectId: String,
  String: String,
  Number: Number,
  Date: Date,
  Boolean: Boolean
};

export default {
  connect: vi.fn().mockResolvedValue({}),
  connection: {
    on: vi.fn(),
    once: vi.fn(),
    close: vi.fn(),
    readyState: 1
  },
  Schema: mockSchema,
  model: vi.fn((name, schema) => {
    return {
      ...mockModel,
      name,
      schema
    };
  }),
  Types: {
    ObjectId: String,
    String: String,
    Number: Number,
    Date: Date,
    Boolean: Boolean
  },
  isValidObjectId: vi.fn(() => true)
};

export const mongoose = {
  connect: vi.fn().mockResolvedValue({}),
  connection: {
    on: vi.fn(),
    once: vi.fn(),
    close: vi.fn()
  },
  Schema: mockSchema,
  model: vi.fn(),
  Types: {
    ObjectId: String
  }
};