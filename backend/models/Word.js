import mongoose from 'mongoose';

const wordSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true
  },
  position: {
    type: Number,
    required: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  authorName: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Word', wordSchema);
