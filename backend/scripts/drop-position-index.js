// backend/scripts/drop-position-index.js (run this once)
import mongoose from 'mongoose';
import Word from '../models/Word.js';

const dropPositionIndex = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/collaborative-book');
    
    // Drop the unique index on position field
    await Word.collection.dropIndex('position_1');
    console.log('✅ Dropped unique index on position field');
    
    // Create a non-unique index for better performance
    await Word.collection.createIndex({ position: 1 });
    console.log('✅ Created non-unique index on position field');
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
};

dropPositionIndex();