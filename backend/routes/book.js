// routes/book.js
// routes/book.js
import express from 'express';
import Word from '../models/Word.js';
import User from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';
import Stats from '../models/Stats.js';
import { getDeletionCost } from '../utils/statsCalculator.js';
import linkedListService from '../services/linkedListService.js';

const router = express.Router();

// Get all words (now using linked list)
router.get('/words', async (req, res) => {
  try {
    const words = await linkedListService.getBookInOrder();
    res.json(words);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching words', error: error.message });
  }
});

// Add a word (requires auth)
// routes/book.js - Complete updated POST endpoint
// Add a word using linked list
router.post('/words', authenticateToken, async (req, res) => {
  try {
    const { text, insertAtPosition } = req.body;
    
    if (!text || text.trim().split(/\s+/).length !== 1) {
      return res.status(400).json({ message: 'Only single words allowed' });
    }
    
    let position;
    const wordCount = await linkedListService.getWordCount();
    
    // Determine insertion position
    if (insertAtPosition !== undefined && insertAtPosition !== null && insertAtPosition <= wordCount) {
      position = insertAtPosition;
    } else {
      position = wordCount; // Append to end
    }
    
    const newWord = await linkedListService.insertWordAtPosition({
      text: text.trim(),
      author: req.user.userId,
      authorName: req.user.username
    }, position);
    
    // Update user's word count
    const user = await User.findById(req.user.userId);
    user.wordsWritten += 1;
    
    if (user.username !== 'admin') {
      if (user.wordsWritten % 3 === 0) {
        user.deleteCredits += 2;
      }
    } else {
      user.deleteCredits = 999999;
    }
    
    await user.save();
    
    res.status(201).json(newWord);
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
// Delete word by position using linked list
router.delete('/words/:position', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    const isAdmin = user.username === 'admin';
    const position = parseInt(req.params.position);
    
    // Get the word to check ownership and likes
    const word = await linkedListService.getWordByOrder(position);
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
    
    // Delete using linked list
    await linkedListService.deleteWordAtPosition(position);
    
    // Update user's delete credits (only for non-admin)
    if (!isAdmin) {
      user.deleteCredits -= deletionCost;
      await user.save();
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

// Get word count (efficient)
router.get('/word-count', async (req, res) => {
  try {
    const count = await linkedListService.getWordCount();
    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: 'Error getting word count', error: error.message });
  }
});

// Get paginated words
router.get('/words/range', async (req, res) => {
  try {
    const start = parseInt(req.query.start) || 0;
    const limit = parseInt(req.query.limit) || 100;
    
    const words = await linkedListService.getWordRange(start, limit);
    res.json(words);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching word range', error: error.message });
  }
});

export default router;
