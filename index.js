import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get the directory name using import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Remove leading slash on Windows
if (process.platform === 'win32' && __dirname.startsWith('/')) {
  __dirname = __dirname.slice(1);
}

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

import adminRoutes from './routes/admin.js';
import analyticsRoutes from './routes/analytics.js';
import workerRoutes from './routes/worker.js';
import bookingRoutes from './routes/booking.js';
import serviceRoutes from './routes/service.js';

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.NODE_ENV === 'development' 
      ? ['http://localhost:3000', 'http://192.168.1.3:3000', 'exp://192.168.1.3:19000']
      : 'https://digital-mistri.onrender.com',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true
  }
});
const PORT = process.env.PORT || 5000;

// UserID <-> socketId mapping
const userSocketMap = new Map();

io.on('connection', (socket) => {
  // On user login, client should emit 'register' with userId and role
  socket.on('register', ({ userId, role }) => {
    if (userId) {
      userSocketMap.set(userId, socket.id);
      socket.data.userId = userId;
      socket.data.role = role;
    }
  });

  socket.on('disconnect', () => {
    if (socket.data.userId) {
      userSocketMap.delete(socket.data.userId);
    }
  });
});

// Helper to emit to a user by userId
export function emitToUser(userId, event, data) {
  const socketId = userSocketMap.get(userId?.toString());
  if (socketId) {
    io.to(socketId).emit(event, data);
  }
}

// Attach io to app for access in routes if needed
app.set('io', io);

// Determine database name based on environment
const dbName = process.env.NODE_ENV === 'development' 
  ? 'digital-mistri-dev' 
  : 'digital-mistri';

// Construct MongoDB URI with database name
const baseURI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const MONGODB_URI = baseURI.endsWith(dbName) ? baseURI : `${baseURI.replace(/\/$/, '')}/${dbName}`;

// Log the configuration
console.log('Starting server with configuration:');
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('Database:', dbName);
console.log('MongoDB URI:', MONGODB_URI.replace(/:[^@]+@/, ':****@')); // Mask password in logs
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'Set' : 'Not set');
console.log('Port:', PORT);

// Log all incoming requests
app.use((req, res, next) => {
  console.log('INCOMING REQUEST:', req.method, req.url);
  next();
});

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'development' 
    ? ['http://localhost:3000', 'http://192.168.1.3:3000', 'exp://192.168.1.3:19000']
    : 'https://digital-mistri.onrender.com',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());

// Request validation middleware
const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.details.map(detail => detail.message)
      });
    }
    next();
  };
};

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

// Apply rate limiting to all requests
app.use(limiter);

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// MongoDB connection configuration
const mongoConfig = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds
  socketTimeoutMS: 45000, // Close socket after 45 seconds of inactivity
  family: 4 // Use IPv4, skip trying IPv6
};

// Connect to MongoDB
mongoose.connect(MONGODB_URI, mongoConfig)
  .then(() => {
    console.log('MongoDB connected successfully');
    console.log('MongoDB URI:', MONGODB_URI.replace(/\/\/$/, '').replace(/:[^@]+@/, ':****@'));
    console.log('MongoDB Connection State:', mongoose.connection.readyState);
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    console.error('Error details:', {
      message: err.message,
      stack: err.stack,
      name: err.name
    });
    process.exit(1); // Exit the process if MongoDB connection fails
  });

// Log MongoDB connection state changes
mongoose.connection.on('connected', () => {
  console.log('MongoDB connection established');
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB connection disconnected');
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB connection reconnected');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing MongoDB connection');
  await mongoose.connection.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing MongoDB connection');
  await mongoose.connection.close();
  process.exit(0);
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
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
app.use('/api/bookings', bookingRoutes);
app.use('/api/services', serviceRoutes);
// Job routes
import jobRoutes from './routes/job.js';
app.use('/api/jobs', jobRoutes);

// Shop routes (admin add, customer view)
import shopRoutes from './routes/shop.js';
app.use('/api/shops', shopRoutes);
import nearbyShopRoutes from './routes/nearbyShop.js';
app.use('/api/nearby-shops', nearbyShopRoutes);

// Customer routes
import customerRoutes from './routes/customer.js';
app.use('/api/customer', customerRoutes);

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

// Auth - Refresh token
app.post('/api/auth/refresh-token', (req, res) => {
  // TODO: Refresh user token
  res.json({ token: 'new_token' });
});

// --- FAKE PAYMENT ENDPOINT (for demo) ---
app.post('/api/fake-payment/start', (req, res) => {
  const { jobId, userId } = req.body;
  const paymentId = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  res.json({ paymentId });

  // Simulate payment processing with a delay
  setTimeout(() => {
    // Emit payment status to all sockets (for demo, you may want to target a specific user in real app)
    io.emit('payment-status', {
      paymentId,
      jobId,
      userId,
      status: 'success',
      message: 'Payment successful (demo)'
    });
  }, 3000); // 3 seconds delay for demo
});

// Root
app.get('/', (req, res) => {
  res.send('Digital Backend Running');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      details: err.message
    });
  }
  
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: 'Authentication Error',
      message: 'Invalid or expired token'
    });
  }
  
  // Default error
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Request timeout middleware
app.use((req, res, next) => {
  req.setTimeout(5000, () => {
    res.status(408).json({
      error: 'Request Timeout',
      message: 'Request took too long to process'
    });
  });
  next();
});

// Start the server (Socket.IO)
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
