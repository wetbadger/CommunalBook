// routes/book.js

import express from 'express';
import Word from '../models/Word.js';
import User from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';
// backend/routes/book.js - Update the delete endpoint
// Add this import at the top
import Stats from '../models/Stats.js';
import { getDeletionCost } from '../utils/statsCalculator.js';

const router = express.Router();

// Test route
router.get('/test', (req, res) => {
  res.json({ message: 'Book routes working' });
});

// Get all words
router.get('/words', async (req, res) => {
  try {
    const words = await Word.find().sort('position');
    res.json(words);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching words', error: error.message });
  }
});

// Add a word (requires auth)
// routes/book.js - Complete updated POST endpoint

router.post('/words', authenticateToken, async (req, res) => {
  try {
    const { text, insertAtPosition } = req.body;
    
    if (!text || text.trim().split(/\s+/).length !== 1) {
      return res.status(400).json({ message: 'Only single words allowed' });
    }
    
    let position;
    let wordCount = await Word.countDocuments();
    
    // Check if we're inserting at a specific position
    if (insertAtPosition !== undefined && insertAtPosition !== null && insertAtPosition <= wordCount) {
      // Inserting in the middle - shift all words from this position right
      position = insertAtPosition;
      await Word.updateMany(
        { position: { $gte: insertAtPosition } },
        { $inc: { position: 1 } }
      );
    } else {
      // Append to end (default behavior)
      position = wordCount;
    }
    
    const word = new Word({
      text: text.trim(),
      position: position,
      author: req.user.userId,
      authorName: req.user.username
    });
    
    await word.save();
    
    // Update user's word count
    const user = await User.findById(req.user.userId);
    user.wordsWritten += 1;
    
    // Only give delete credits to non-admin users
    if (user.username !== 'admin') {
      if (user.wordsWritten % 3 === 0) {
        user.deleteCredits += 2;
      }
    } else {
      user.deleteCredits = 999999;
    }
    
    await user.save();
    
    // Return the updated word
    res.status(201).json(word);
  } catch (error) {
    console.error('Add word error:', error);
    res.status(500).json({ message: 'Error adding word', error: error.message });
  }
});

// Delete all words (admin only)
router.delete('/words', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    
    // Check if user is admin
    if (user.username !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const deletedCount = await Word.countDocuments();
    await Word.deleteMany({});
    
    // Reset positions for any future words
    // No need to reorder since all words are deleted
    
    res.json({ 
      message: 'All words deleted successfully', 
      deletedCount: deletedCount 
    });
  } catch (error) {
    console.error('Delete all words error:', error);
    res.status(500).json({ message: 'Error deleting all words', error: error.message });
  }
});

// Get user stats
router.get('/user-stats', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    res.json({
      wordsWritten: user.wordsWritten,
      deleteCredits: user.username === 'admin' ? 'unlimited' : user.deleteCredits,
      username: user.username
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user stats', error: error.message });
  }
});

// Like a word
router.post('/words/:wordId/like', authenticateToken, async (req, res) => {
  try {
    const word = await Word.findById(req.params.wordId);
    
    if (!word) {
      return res.status(404).json({ message: 'Word not found' });
    }
    
    // Check if user already liked this word
    if (word.likedBy.includes(req.user.userId)) {
      return res.status(400).json({ message: 'You already liked this word' });
    }
    
    // Add like
    word.likes += 1;
    word.likedBy.push(req.user.userId);
    await word.save();
    
    res.json({ 
      message: 'Word liked successfully',
      likes: word.likes,
      liked: true
    });
  } catch (error) {
    console.error('Like word error:', error);
    res.status(500).json({ message: 'Error liking word', error: error.message });
  }
});

// Unlike a word
router.delete('/words/:wordId/like', authenticateToken, async (req, res) => {
  try {
    const word = await Word.findById(req.params.wordId);
    
    if (!word) {
      return res.status(404).json({ message: 'Word not found' });
    }
    
    // Check if user has liked this word
    const likeIndex = word.likedBy.indexOf(req.user.userId);
    if (likeIndex === -1) {
      return res.status(400).json({ message: 'You haven\'t liked this word' });
    }
    
    // Remove like
    word.likes -= 1;
    word.likedBy.splice(likeIndex, 1);
    await word.save();
    
    res.json({ 
      message: 'Like removed successfully',
      likes: word.likes,
      liked: false
    });
  } catch (error) {
    console.error('Unlike word error:', error);
    res.status(500).json({ message: 'Error unliking word', error: error.message });
  }
});

// Check if user liked a specific word
router.get('/words/:wordId/like-status', authenticateToken, async (req, res) => {
  try {
    const word = await Word.findById(req.params.wordId);
    
    if (!word) {
      return res.status(404).json({ message: 'Word not found' });
    }
    
    const liked = word.likedBy.includes(req.user.userId);
    
    res.json({ 
      liked,
      likes: word.likes
    });
  } catch (error) {
    console.error('Check like status error:', error);
    res.status(500).json({ message: 'Error checking like status', error: error.message });
  }
});

// Update the DELETE endpoint for words
router.delete('/words/:position', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    
    // Check if user is admin (unlimited credits)
    const isAdmin = user.username === 'admin';
    
    const word = await Word.findOne({ position: parseInt(req.params.position) });
    if (!word) {
      return res.status(404).json({ message: 'Word not found' });
    }
    
    // Don't allow deleting own words for non-admin users
    if (!isAdmin && word.author.toString() === req.user.userId) {
      return res.status(403).json({ message: 'Cannot delete your own words' });
    }
    
    // Get latest stats for cost calculation
    const stats = await Stats.findOne();
    let deletionCost = 1;
    
    if (stats && !isAdmin) {
      deletionCost = getDeletionCost(word.likes, stats.averageLikes, stats.stdDeviation);
    }
    
    // Check if user has enough credits (non-admin only)
    if (!isAdmin && user.deleteCredits < deletionCost) {
      return res.status(403).json({ 
        message: `Not enough credits. This word costs ${deletionCost} credit(s) to delete. You have ${user.deleteCredits} credits.`,
        requiredCredits: deletionCost,
        availableCredits: user.deleteCredits
      });
    }
    
    await word.deleteOne();
    
    // Update user's delete credits (only for non-admin)
    if (!isAdmin) {
      user.deleteCredits -= deletionCost;
      await user.save();
    }
    
    // Reorder remaining words
    const remainingWords = await Word.find({ position: { $gt: word.position } }).sort('position');
    for (let i = 0; i < remainingWords.length; i++) {
      remainingWords[i].position -= 1;
      await remainingWords[i].save();
    }
    
    res.json({ 
      message: 'Word deleted successfully', 
      remainingCredits: isAdmin ? 'unlimited' : user.deleteCredits,
      cost: deletionCost
    });
  } catch (error) {
    console.error('Delete word error:', error);
    res.status(500).json({ message: 'Error deleting word', error: error.message });
  }
});

// Add endpoint to get deletion cost for a word
router.get('/words/:wordId/deletion-cost', authenticateToken, async (req, res) => {
  try {
    const word = await Word.findById(req.params.wordId);
    if (!word) {
      return res.status(404).json({ message: 'Word not found' });
    }
    
    const stats = await Stats.findOne();
    let deletionCost = 1;
    let deviation = 0;
    
    if (stats) {
      deletionCost = getDeletionCost(word.likes, stats.averageLikes, stats.stdDeviation);
      deviation = stats.stdDeviation === 0 ? 0 : (word.likes - stats.averageLikes) / stats.stdDeviation;
    }
    
    res.json({
      cost: deletionCost,
      likes: word.likes,
      averageLikes: stats?.averageLikes || 0,
      stdDeviation: stats?.stdDeviation || 0,
      deviations: deviation
    });
  } catch (error) {
    console.error('Error getting deletion cost:', error);
    res.status(500).json({ message: 'Error getting deletion cost', error: error.message });
  }
});

export default router;
