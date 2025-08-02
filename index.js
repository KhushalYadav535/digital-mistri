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

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
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
import paymentRoutes from './routes/payment.js';

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.NODE_ENV === 'development' 
      ? ['http://localhost:3000', 'http://192.168.1.43:3000', 'exp://192.168.1.43:19000']
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
    ? ['http://localhost:3000', 'http://192.168.1.3:3000', 'exp://192.168.1.3:19000', 'http://192.168.1.43:3000', 'exp://192.168.1.43:19000']
    : 'https://digital-mistri.onrender.com',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
// Increase payload limit for base64 images
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static files from the 'uploads' directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

// Apply rate limiting only in production
if (process.env.NODE_ENV !== 'development') {
  app.use(limiter);
}

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
    
    // In development, don't exit the process, just log the error
    if (process.env.NODE_ENV === 'development') {
      console.log('Continuing without MongoDB in development mode...');
    } else {
      process.exit(1); // Exit the process if MongoDB connection fails in production
    }
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

// Root test endpoint
app.get('/test', (req, res) => {
  console.log('Root test endpoint hit');
  res.json({ 
    message: 'Backend is working!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// --- ROUTES ---
// Admin routes
app.use('/api/admin', adminRoutes);
app.use('/api/admin/analytics', analyticsRoutes);
// Worker routes
app.use('/api/worker', workerRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payment', paymentRoutes);
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

// Notification routes
import notificationRoutes from './routes/notifications.js';
app.use('/api/notifications', notificationRoutes);

// Support routes
import supportRoutes from './routes/support.js';
app.use('/api/support', supportRoutes);

// Auth routes
import authRoutes from './routes/auth.js';
app.use('/api/auth', authRoutes);

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



// Real payment endpoint for nearby shop creation
app.post('/api/real-payment/nearby-shop', async (req, res) => {
  try {
    const { shopData, paymentAmount, paymentReference, customerId } = req.body;
    
    console.log('💰 Real Payment Request:', {
      paymentAmount,
      paymentReference,
      customerId,
      hasShopData: !!shopData
    });

    if (!shopData || !paymentAmount || !customerId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required data: shopData, paymentAmount, or customerId'
      });
    }

    // Validate payment amount (should be 50 for monthly or 8000 for yearly)
    const validAmounts = [50, 8000];
    if (!validAmounts.includes(paymentAmount)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment amount. Must be ₹50 (monthly) or ₹8000 (yearly)'
      });
    }

    // For real payments, we'll create the shop immediately
    // In a production system, you'd verify the payment with UPI gateway first
    try {
      const NearbyShop = await import('./models/NearbyShop.js').then(mod => mod.default);
      
      // Debug: Log image data
      console.log('🖼️ Real Payment - Image data:', {
        image: shopData.image,
        images: shopData.images,
        hasImage: !!shopData.image,
        imageType: typeof shopData.image
      });
      
      // Handle images properly with Cloudinary upload
      let images = [];
      if (shopData.image) {
        try {
          // If it's a local file URI, we need to handle it differently for mobile apps
          if (shopData.image.startsWith('file://') || shopData.image.startsWith('content://')) {
            console.log('📱 Mobile app image detected:', shopData.image);
            
            // For mobile app images, we can't directly upload file:// URIs to Cloudinary
            // from the server. We need to either:
            // 1. Convert to base64 and upload
            // 2. Use a placeholder for test payments
            // 3. Skip image for now and let user upload later
            
            console.log('⚠️ Real payment: Image upload not supported for mobile app file URIs');
            // For real payments, we might need to implement base64 upload
            images = [];
            
          } else if (shopData.image.startsWith('data:image/')) {
            // Base64 image data
            console.log('📤 Uploading base64 image to Cloudinary...');
            
            try {
              const { cloudinary } = await import('./utils/cloudinary.js');
              
              // Upload base64 data to Cloudinary
              const result = await cloudinary.uploader.upload(shopData.image, {
                folder: 'digital-mistri',
                transformation: [
                  { width: 1000, height: 1000, crop: 'limit' },
                  { quality: 'auto:good' },
                  { fetch_format: 'auto' }
                ]
              });
              
              images = [result.secure_url];
              console.log('✅ Base64 image uploaded to Cloudinary:', result.secure_url);
            } catch (uploadError) {
              console.error('❌ Failed to upload base64 image:', uploadError);
              images = [];
            }
            
          } else if (shopData.image.startsWith('http')) {
            // If it's already a URL, use it directly
            images = [shopData.image];
            console.log('🔗 Using existing image URL:', shopData.image);
          } else {
            // If it's a relative path, construct the full URL properly
            const baseUrl = process.env.API_URL || 'http://localhost:5000';
            const cleanBaseUrl = baseUrl.replace(/\/$/, '');
            const cleanImagePath = shopData.image.replace(/^\//, '');
            const constructedUrl = `${cleanBaseUrl}/${cleanImagePath}`;
            
            console.log('🧪 Real payment detected, attempting Cloudinary upload for local file');
            try {
              const { cloudinary } = await import('./utils/cloudinary.js');
              const result = await cloudinary.uploader.upload(constructedUrl, {
                folder: 'digital-mistri',
                transformation: [
                  { width: 1000, height: 1000, crop: 'limit' },
                  { quality: 'auto:good' },
                  { fetch_format: 'auto' }
                ]
              });
              images = [result.secure_url];
              console.log('✅ Local file uploaded to Cloudinary:', result.secure_url);
            } catch (uploadError) {
              console.log('⚠️ Failed to upload local file to Cloudinary, using fallback');
              images = [];
            }
          }
        } catch (imageError) {
          console.error('❌ Error processing image:', imageError);
          images = [];
        }
      }
      
      // Add fallback image for real shops if no image provided
      if (images.length === 0) {
        // Use a simple, reliable placeholder that works on mobile
        images = ['https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&h=400&fit=crop'];
        console.log('📷 Using fallback image for real shop:', images[0]);
      }
      
      const shop = await NearbyShop.create({
        name: shopData.name.trim(),
        description: shopData.description.trim(),
        address: {
          street: shopData.address.street.trim(),
          city: shopData.address.city.trim(),
          state: shopData.address.state.trim(),
          pincode: shopData.address.pincode.trim()
        },
        location: {
          type: 'Point',
          coordinates: [
            parseFloat(shopData.location.coordinates[0]),
            parseFloat(shopData.location.coordinates[1])
          ]
        },
        phone: shopData.phone.trim(),
        email: shopData.email.trim(),
        services: shopData.services || [],
        workingHours: shopData.workingHours || {
          monday: { open: '09:00', close: '18:00' },
          tuesday: { open: '09:00', close: '18:00' },
          wednesday: { open: '09:00', close: '18:00' },
          thursday: { open: '09:00', close: '18:00' },
          friday: { open: '09:00', close: '18:00' },
          saturday: { open: '09:00', close: '18:00' },
          sunday: { open: '09:00', close: '18:00' }
        },
        images: images,
        isActive: true,
        customerId: customerId,
        paymentAmount: paymentAmount,
        paymentReference: paymentReference || `PAY_${Date.now()}`,
        subscriptionType: paymentAmount === 50 ? 'monthly' : 'yearly',
        subscriptionStartDate: new Date(),
        subscriptionEndDate: new Date(Date.now() + (paymentAmount === 50 ? 30 : 365) * 24 * 60 * 60 * 1000)
      });

      console.log('✅ Real payment shop created successfully:', {
        id: shop._id,
        name: shop.name,
        location: shop.location.coordinates,
        images: shop.images,
        paymentAmount: shop.paymentAmount,
        subscriptionType: shop.subscriptionType
      });

      // Emit real payment success
      io.emit('real-payment-status', {
        shopId: shop._id,
        shopData,
        paymentAmount,
        paymentReference,
        status: 'success',
        message: `Real payment successful (₹${paymentAmount})`,
        subscriptionType: shop.subscriptionType
      });

      res.status(201).json({
        success: true,
        message: 'Real payment successful and shop created',
        shopId: shop._id,
        paymentAmount,
        subscriptionType: shop.subscriptionType
      });

    } catch (error) {
      console.error('❌ Error creating real payment shop:', error);
      res.status(500).json({
        success: false,
        message: 'Real payment successful but shop creation failed',
        error: error.message
      });
    }

  } catch (error) {
    console.error('❌ Real payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Real payment processing failed',
      error: error.message
    });
  }
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
