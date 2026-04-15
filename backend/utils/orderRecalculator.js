import cron from 'node-cron';
import linkedListService from '../services/linkedListService.js';

// Recalculate order numbers periodically (every hour)
cron.schedule('0 * * * *', async () => {
  console.log('🔄 Recalculating word order numbers...');
  try {
    await linkedListService.recalculateOrders();
    console.log('✅ Word order numbers updated');
  } catch (error) {
    console.error('❌ Error recalculating order numbers:', error);
  }
});