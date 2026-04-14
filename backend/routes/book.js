import express from 'express';
import Word from '../models/Word.js';
import User from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';

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
router.post('/words', authenticateToken, async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text || text.trim().split(/\s+/).length !== 1) {
      return res.status(400).json({ message: 'Only single words allowed' });
    }
    
    const wordCount = await Word.countDocuments();
    const word = new Word({
      text: text.trim(),
      position: wordCount,
      author: req.user.userId,
      authorName: req.user.username
    });
    
    await word.save();
    
    // Update user's word count
    const user = await User.findById(req.user.userId);
    user.wordsWritten += 1;
    
    // Every 5 words gives a delete credit
    if (user.wordsWritten % 5 === 0) {
      user.deleteCredits += 1;
    }
    
    await user.save();
    
    res.status(201).json(word);
  } catch (error) {
    console.error('Add word error:', error);
    res.status(500).json({ message: 'Error adding word', error: error.message });
  }
});

// Delete a word (requires auth)
router.delete('/words/:position', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    
    if (user.deleteCredits <= 0) {
      return res.status(403).json({ message: 'No delete credits available' });
    }
    
    const word = await Word.findOne({ position: parseInt(req.params.position) });
    if (!word) {
      return res.status(404).json({ message: 'Word not found' });
    }
    
    // Don't allow deleting own words
    if (word.author.toString() === req.user.userId) {
      return res.status(403).json({ message: 'Cannot delete your own words' });
    }
    
    await word.deleteOne();
    
    // Update user's delete credits
    user.deleteCredits -= 1;
    await user.save();
    
    // Reorder remaining words
    const remainingWords = await Word.find({ position: { $gt: word.position } }).sort('position');
    for (let i = 0; i < remainingWords.length; i++) {
      remainingWords[i].position -= 1;
      await remainingWords[i].save();
    }
    
    res.json({ message: 'Word deleted successfully', remainingCredits: user.deleteCredits });
  } catch (error) {
    console.error('Delete word error:', error);
    res.status(500).json({ message: 'Error deleting word', error: error.message });
  }
});

// Get user stats
router.get('/user-stats', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    res.json({
      wordsWritten: user.wordsWritten,
      deleteCredits: user.deleteCredits,
      username: user.username
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user stats', error: error.message });
  }
});

export default router;
