import mongoose from 'mongoose';

const wordSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true
  },
  // Linked list pointers
  nextWord: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Word',
    default: null
  },
  prevWord: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Word',
    default: null
  },
  // REMOVED: order field - no longer needed
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  authorName: {
    type: String,
    required: true
  },
  likes: {
    type: Number,
    default: 0
  },
  likedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Word', wordSchema);