import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server } from 'socket.io';
import http from 'http';
import authRoutes from './routes/auth.js';
import bookRoutes from './routes/book.js';
// backend/server.js - Add stats calculation scheduler
import cron from 'node-cron';
import { calculateLikeStats } from './utils/statsCalculator.js';

// Add this after MongoDB connection
// Calculate stats on server startup
calculateLikeStats();

// Schedule stats calculation every 5 minutes
cron.schedule('*/5 * * * *', () => {
  console.log('🔄 Running scheduled like stats calculation...');
  calculateLikeStats();
});

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Make io accessible to routes
app.set('io', io);

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/collaborative-book')
.then(() => {
  console.log('✅ MongoDB connected successfully');
  console.log('Database:', mongoose.connection.name);
})
.catch(err => {
  console.error('❌ MongoDB connection error:', err.message);
  console.error('\n💡 Troubleshooting tips:');
  console.error('1. Make sure MongoDB is installed and running');
  console.error('2. Check your MONGODB_URI in .env file');
  process.exit(1);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/book', bookRoutes);

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('🔌 User connected:', socket.id);
  
  // Handle word added event
  socket.on('word-added', (data) => {
    console.log('Word added:', data);
    // Broadcast to all other users
    socket.broadcast.emit('word-update', { type: 'add', data });
  });
  
  // Handle word deleted event
  socket.on('word-deleted', (data) => {
    console.log('Word deleted:', data);
    // Broadcast to all other users
    socket.broadcast.emit('word-update', { type: 'delete', data });
  });
  
  // Handle user typing indicator
  socket.on('user-typing', (data) => {
    socket.broadcast.emit('user-typing', { 
      userId: socket.id, 
      username: data.username 
    });
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('🔌 User disconnected:', socket.id);
    socket.broadcast.emit('user-left', { userId: socket.id });
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    message: 'Internal server error', 
    error: err.message 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket server ready for connections`);
});
