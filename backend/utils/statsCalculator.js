// backend/utils/statsCalculator.js
import Word from '../models/Word.js';
import Stats from '../models/Stats.js';

export const calculateLikeStats = async () => {
  try {
    const words = await Word.find({}, 'likes');
    
    if (words.length === 0) {
      // No words, set default stats
      await Stats.findOneAndUpdate(
        {},
        {
          averageLikes: 0,
          stdDeviation: 0,
          totalWords: 0,
          lastCalculated: new Date()
        },
        { upsert: true, new: true }
      );
      return;
    }
    
    // Calculate average
    const totalLikes = words.reduce((sum, word) => sum + word.likes, 0);
    const average = totalLikes / words.length;
    
    // Calculate standard deviation
    const squaredDiffs = words.map(word => Math.pow(word.likes - average, 2));
    const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / words.length;
    const stdDev = Math.sqrt(variance);
    
    // Update stats
    await Stats.findOneAndUpdate(
      {},
      {
        averageLikes: average,
        stdDeviation: stdDev,
        totalWords: words.length,
        lastCalculated: new Date()
      },
      { upsert: true, new: true }
    );
    
    console.log(`📊 Stats updated: avg=${average.toFixed(2)}, stdDev=${stdDev.toFixed(2)}, words=${words.length}`);
  } catch (error) {
    console.error('Error calculating like stats:', error);
  }
};

export const getDeletionCost = (likes, average, stdDev) => {
  if (stdDev === 0) return 1; // No variation, base cost
  
  const deviations = (likes - average) / stdDev;
  
  if (deviations >= 3) return 1000;
  if (deviations >= 2) return 100;
  if (deviations >= 1) return 10;
  return 1;
};