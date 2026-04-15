// scripts/migrateToLinkedList.js
import mongoose from 'mongoose';
import Word from '../models/Word.js';
import linkedListService from '../services/linkedListService.js';

async function migrateToLinkedList() {
  try {
    // Get all words sorted by position
    const words = await Word.find().sort('position').lean();
    
    // Clear all pointer fields
    await Word.updateMany({}, { $unset: { nextWord: "", prevWord: "" } });
    
    // Set up linked list
    for (let i = 0; i < words.length; i++) {
      const current = await Word.findById(words[i]._id);
      
      if (i > 0) {
        current.prevWord = words[i - 1]._id;
      }
      
      if (i < words.length - 1) {
        current.nextWord = words[i + 1]._id;
      }
      
      current.order = i;
      await current.save();
    }
    
    console.log(`✅ Migrated ${words.length} words to linked list structure`);
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
  }
}

// Run migration
migrateToLinkedList();