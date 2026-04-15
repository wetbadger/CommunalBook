// backend/models/Stats.js
import mongoose from 'mongoose';

const statsSchema = new mongoose.Schema({
  averageLikes: {
    type: Number,
    default: 0
  },
  stdDeviation: {
    type: Number,
    default: 0
  },
  totalWords: {
    type: Number,
    default: 0
  },
  lastCalculated: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Stats', statsSchema);