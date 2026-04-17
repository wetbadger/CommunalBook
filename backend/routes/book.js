// backend/routes/book.js
import express from 'express';
import Word from '../models/Word.js';
import User from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';
import { idempotencyMiddleware } from '../middleware/idempotency.js';
import Stats from '../models/Stats.js';
import { getDeletionCost } from '../utils/statsCalculator.js';
import linkedListService from '../services/linkedListService.js';

const router = express.Router();

// ==================== GET ROUTES ====================

// Get all words
router.get('/words', async (req, res) => {
  try {
    const words = await linkedListService.getBookInOrder();
    res.json(words);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching words', error: error.message });
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

// Get deletion cost for a word
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

// Get word count
router.get('/word-count', async (req, res) => {
  try {
    const count = await linkedListService.getWordCount();
    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: 'Error getting word count', error: error.message });
  }
});

// ==================== POST ROUTES ====================

// Add a word - supports insertAfter, insertBefore, or append
router.post('/words', 
  authenticateToken, 
  idempotencyMiddleware,
  async (req, res) => {
    try {
      const { text, insertAfterWordId, insertBeforeWordId } = req.body;
      
      if (!text || text.trim().split(/\s+/).length !== 1) {
        return res.status(400).json({ message: 'Only single words allowed' });
      }
      
      let newWord;
      
      // Determine insertion method
      console.log(insertAfterWordId);
      console.log(insertBeforeWordId);
      if (insertAfterWordId !== undefined && insertAfterWordId !== null) {
        // Insert after specific word
        newWord = await linkedListService.insertWordAfter({
          text: text.trim(),
          author: req.user.userId,
          authorName: req.user.username
        }, insertAfterWordId);
      } else if (insertBeforeWordId !== undefined) {
        // Insert before specific word
        newWord = await linkedListService.insertWordBefore({
          text: text.trim(),
          author: req.user.userId,
          authorName: req.user.username
        }, insertBeforeWordId);
      } else {
        // Append to end (default)
        newWord = await linkedListService.appendWord({
          text: text.trim(),
          author: req.user.userId,
          authorName: req.user.username
        });
      }
      
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
      
      // Return idempotency key if present
      const idempotencyKey = req.headers['idempotency-key'];
      if (idempotencyKey) {
        res.setHeader('X-Idempotency-Key', idempotencyKey);
      }
      
      res.status(201).json({
        ...newWord.toObject(),
        idempotencyKey: idempotencyKey
      });
    } catch (error) {
      console.error('Add word error:', error);
      res.status(500).json({ message: 'Error adding word', error: error.message });
    }
  }
);

// Like a word
router.post('/words/:wordId/like', 
  authenticateToken, 
  idempotencyMiddleware,
  async (req, res) => {
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
      
      const idempotencyKey = req.headers['idempotency-key'];
      if (idempotencyKey) {
        res.setHeader('X-Idempotency-Key', idempotencyKey);
      }
      
      res.json({ 
        message: 'Word liked successfully',
        likes: word.likes,
        liked: true,
        idempotencyKey: idempotencyKey
      });
    } catch (error) {
      console.error('Like word error:', error);
      res.status(500).json({ message: 'Error liking word', error: error.message });
    }
  }
);

// ==================== DELETE ROUTES ====================

// Delete all words (admin only)
router.delete('/words', 
  authenticateToken, 
  idempotencyMiddleware,
  async (req, res) => {
    try {
      const user = await User.findById(req.user.userId);
      
      if (user.username !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }
      
      const deletedCount = await Word.countDocuments();
      await Word.deleteMany({});
      
      const idempotencyKey = req.headers['idempotency-key'];
      if (idempotencyKey) {
        res.setHeader('X-Idempotency-Key', idempotencyKey);
      }
      
      res.json({ 
        message: 'All words deleted successfully', 
        deletedCount: deletedCount,
        idempotencyKey: idempotencyKey
      });
    } catch (error) {
      console.error('Delete all words error:', error);
      res.status(500).json({ message: 'Error deleting all words', error: error.message });
    }
  }
);

// Delete word by ID
router.delete('/words/:wordId', 
  authenticateToken, 
  idempotencyMiddleware,
  async (req, res) => {
    try {
      const user = await User.findById(req.user.userId);
      const isAdmin = user.username === 'admin';
      const wordId = req.params.wordId;
      
      // Get the word to check ownership and likes
      const word = await Word.findById(wordId);
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
      await linkedListService.deleteWordById(wordId);
      
      // Update user's delete credits (only for non-admin)
      if (!isAdmin) {
        user.deleteCredits -= deletionCost;
        await user.save();
      }
      
      const idempotencyKey = req.headers['idempotency-key'];
      if (idempotencyKey) {
        res.setHeader('X-Idempotency-Key', idempotencyKey);
      }
      
      res.json({ 
        message: 'Word deleted successfully', 
        remainingCredits: isAdmin ? 'unlimited' : user.deleteCredits,
        cost: deletionCost,
        deletedWordId: wordId,
        idempotencyKey: idempotencyKey
      });
    } catch (error) {
      console.error('Delete word error:', error);
      res.status(500).json({ message: 'Error deleting word', error: error.message });
    }
  }
);

// Unlike a word
router.delete('/words/:wordId/like', 
  authenticateToken, 
  idempotencyMiddleware,
  async (req, res) => {
    try {
      const word = await Word.findById(req.params.wordId);
      
      if (!word) {
        return res.status(404).json({ message: 'Word not found' });
      }
      
      const likeIndex = word.likedBy.indexOf(req.user.userId);
      if (likeIndex === -1) {
        return res.status(400).json({ message: 'You haven\'t liked this word' });
      }
      
      word.likes -= 1;
      word.likedBy.splice(likeIndex, 1);
      await word.save();
      
      const idempotencyKey = req.headers['idempotency-key'];
      if (idempotencyKey) {
        res.setHeader('X-Idempotency-Key', idempotencyKey);
      }
      
      res.json({ 
        message: 'Like removed successfully',
        likes: word.likes,
        liked: false,
        idempotencyKey: idempotencyKey
      });
    } catch (error) {
      console.error('Unlike word error:', error);
      res.status(500).json({ message: 'Error unliking word', error: error.message });
    }
  }
);

export default router;