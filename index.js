import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

import adminRoutes from './routes/admin.js';
import analyticsRoutes from './routes/analytics.js';
import workerRoutes from './routes/worker.js';

// Load env vars
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

// Log all incoming requests
app.use((req, res, next) => {
  console.log('INCOMING REQUEST:', req.method, req.url);
  next();
});

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => {
    console.log('MongoDB connected successfully');
    console.log('MongoDB URI:', MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//****:****@'));
    console.log('MongoDB Connection State:', mongoose.connection.readyState);
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    console.error('Error details:', {
      message: err.message,
      stack: err.stack,
      name: err.name
    });
  });

// Log MongoDB connection state changes
mongoose.connection.on('connected', () => {
  console.log('MongoDB connection established');
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB connection disconnected');
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Test endpoint - moved to top for easier access
app.get('/api/test', (req, res) => {
  console.log('Test endpoint hit');
  res.json({ message: 'Backend is working!' });
});

// --- ROUTES ---
// Admin routes
app.use('/api/admin', adminRoutes);
app.use('/api/admin/analytics', analyticsRoutes);
// Worker routes
app.use('/api/worker', workerRoutes);
// Job routes
import jobRoutes from './routes/job.js';
app.use('/api/jobs', jobRoutes);

// Notifications
app.get('/api/notifications', (req, res) => {
  // TODO: Fetch notifications from DB
  res.json([]);
});
app.patch('/api/notifications/:id/read', (req, res) => {
  // TODO: Mark notification as read
  res.json({ success: true });
});
app.patch('/api/notifications/mark-all-read', (req, res) => {
  // TODO: Mark all notifications as read
  res.json({ success: true });
});
app.delete('/api/notifications/:id', (req, res) => {
  // TODO: Delete notification
  res.json({ success: true });
});

// Support
app.post('/api/support', (req, res) => {
  // TODO: Save support request
  res.json({ success: true });
});

// Change password
app.post('/api/users/change-password', (req, res) => {
  // TODO: Change user password
  res.json({ success: true });
});

// Bookings
app.get('/api/bookings', (req, res) => {
  // TODO: Fetch bookings from DB
  res.json([]);
});
app.post('/api/bookings', (req, res) => {
  // TODO: Create new booking
  res.json({ success: true });
});

// Auth - Refresh token
app.post('/api/auth/refresh-token', (req, res) => {
  // TODO: Refresh user token
  res.json({ token: 'new_token' });
});

// Root
app.get('/', (req, res) => {
  res.send('Digital Backend Running');
});

// Listen on all interfaces for LAN access
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
