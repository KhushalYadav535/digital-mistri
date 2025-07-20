import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';
import Worker from '../models/Worker.js';
import Service from '../models/Service.js';
import ServicePrice from '../models/ServicePrice.js';
import { adminAuth } from '../middleware/auth.js';
import mongoose from 'mongoose';

const router = express.Router();

// Admin Login
router.post('/login', async (req, res) => {
  console.log('=== Admin Login Request ===');
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  
  const { email, password } = req.body;
  
  // Input validation
  if (!email || !password) {
    console.log('Missing email or password');
    return res.status(400).json({ 
      message: 'Email and password are required',
      received: { email: !!email, password: !!password }
    });
  }
  
  try {
    console.log('Looking up admin:', email);
    const admin = await Admin.findOne({ email });
    
    if (!admin) {
      console.log('Admin not found:', email);
      return res.status(404).json({ 
        message: 'Admin not found',
        email: email
      });
    }
    
    console.log('Admin found, comparing password...');
    const isMatch = await bcrypt.compare(password, admin.password);
    
    if (!isMatch) {
      console.log('Invalid password for admin:', email);
      return res.status(400).json({ 
        message: 'Invalid credentials',
        email: email
      });
    }
    
    console.log('Password matched, generating token...');
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not set!');
      return res.status(500).json({ 
        message: 'Server configuration error',
        error: 'JWT_SECRET is not set'
      });
    }
    
    const token = jwt.sign(
      { id: admin._id, role: 'admin' }, 
      process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );
    
    console.log('Login successful for admin:', email);
    const response = {
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role
      }
    };
    
    console.log('Sending response:', response);
    res.json(response);
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ 
      message: 'Server error',
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// Refresh Token
router.post('/auth/refresh-token', adminAuth, (req, res) => {
  const user = req.user;
  const token = jwt.sign({ id: user.id, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token });
});

// Get all workers
router.get('/workers', adminAuth, async (req, res) => {
  try {
    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      console.log('MongoDB not connected, returning mock data');
      // Return mock data for development
      const mockWorkers = [
        {
          _id: 'mock-worker-1',
          name: 'John Doe',
          email: 'john@example.com',
          phone: '1234567890',
          isVerified: true,
          isAvailable: true,
          services: ['plumber', 'electrician'],
          stats: {
            totalBookings: 15,
            completedBookings: 12,
            totalEarnings: 2500
          }
        },
        {
          _id: 'mock-worker-2',
          name: 'Jane Smith',
          email: 'jane@example.com',
          phone: '0987654321',
          isVerified: false,
          isAvailable: true,
          services: ['beautician'],
          stats: {
            totalBookings: 8,
            completedBookings: 6,
            totalEarnings: 1200
          }
        }
      ];
      return res.json(mockWorkers);
    }
    
    const workers = await Worker.find();
    res.json(workers);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch workers' });
  }
});

// Get single worker by ID (admin detail view)
router.get('/workers/:id', adminAuth, async (req, res) => {
  try {
    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      console.log('MongoDB not connected, returning mock worker data');
      // Return mock data for development
      const mockWorkers = {
        'mock-worker-1': {
          _id: 'mock-worker-1',
          name: 'John Doe',
          email: 'john@example.com',
          phone: '1234567890',
          isVerified: true,
          isAvailable: true,
          services: ['plumber', 'electrician'],
          stats: {
            totalBookings: 15,
            completedBookings: 12,
            totalEarnings: 2500
          }
        },
        'mock-worker-2': {
          _id: 'mock-worker-2',
          name: 'Jane Smith',
          email: 'jane@example.com',
          phone: '0987654321',
          isVerified: false,
          isAvailable: true,
          services: ['beautician'],
          stats: {
            totalBookings: 8,
            completedBookings: 6,
            totalEarnings: 1200
          }
        }
      };
      
      const worker = mockWorkers[req.params.id];
      if (!worker) return res.status(404).json({ message: 'Worker not found' });
      return res.json(worker);
    }
    
    const worker = await Worker.findById(req.params.id);
    if (!worker) return res.status(404).json({ message: 'Worker not found' });
    res.json(worker);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch worker detail' });
  }
});

// Add worker
router.post('/workers', adminAuth, async (req, res) => {
  const { name, email, phone, services } = req.body;
  try {
    if (!name || !email || !phone) {
      return res.status(400).json({ message: 'Name, email, and phone are required' });
    }
    const exists = await Worker.findOne({ email });
    if (exists) {
      // Update existing worker's services
      if (services && services.length > 0) {
        exists.services = services;
        await exists.save();
        console.log('Updated worker services:', { email, services });
        return res.json(exists);
      }
      return res.status(400).json({ message: 'Worker already exists' });
    }
    // Always set password as hashed phone number
    if (!phone) {
      return res.status(400).json({ message: 'Phone is required for worker password' });
    }
    const hashedPassword = await bcrypt.hash(phone, 10);
    const worker = new Worker({
      name,
      email,
      phone,
      password: hashedPassword,
      isVerified: true, // Auto-verify for testing
      isAvailable: true,
      services: services || [],
      stats: {
        totalBookings: 0,
        completedBookings: 0,
        totalEarnings: 0
      }
    });
    await worker.save();
    console.log('Worker created:', { name, email, phone, services });
    res.status(201).json(worker);
  } catch (err) {
    console.error('Failed to add worker:', err);
    res.status(500).json({ message: 'Failed to add worker', error: err.message });
  }
});

// Approve/Block worker
router.put('/workers/:id', adminAuth, async (req, res) => {
  const { isVerified } = req.body;
  try {
    const worker = await Worker.findByIdAndUpdate(req.params.id, { isVerified }, { new: true });
    if (!worker) return res.status(404).json({ message: 'Worker not found' });
    res.json(worker);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update worker' });
  }
});

// Delete/Reject worker
router.delete('/workers/:id', adminAuth, async (req, res) => {
  try {
    const worker = await Worker.findByIdAndDelete(req.params.id);
    if (!worker) return res.status(404).json({ message: 'Worker not found' });
    res.json({ message: 'Worker deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete worker' });
  }
});

// Get all services (admin)
router.get('/services', adminAuth, async (req, res) => {
  try {
    const services = await Service.find().sort({ createdAt: -1 });
    res.json(services);
  } catch (err) {
    console.error('Failed to fetch services:', err);
    res.status(500).json({ message: 'Failed to fetch services' });
  }
});

// Get all service prices (admin)
router.get('/service-prices', adminAuth, async (req, res) => {
  try {
    const servicePrices = await ServicePrice.find({ isActive: true }).sort({ updatedAt: -1 });
    res.json(servicePrices);
  } catch (err) {
    console.error('Failed to fetch service prices:', err);
    res.status(500).json({ message: 'Failed to fetch service prices' });
  }
});

// Add new service (admin)
router.post('/services', adminAuth, async (req, res) => {
  try {
    const { name, description, rate, category } = req.body;
    
    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Service name is required' });
    }
    if (!rate || isNaN(rate) || rate <= 0) {
      return res.status(400).json({ message: 'Valid rate is required' });
    }
    
    // Check if service with same name already exists
    const existingService = await Service.findOne({ name: name.trim() });
    if (existingService) {
      return res.status(400).json({ message: 'Service with this name already exists' });
    }
    
    const service = new Service({
      name: name.trim(),
      description: description?.trim() || '',
      rate: parseFloat(rate),
      category: category?.trim() || 'General',
      isActive: true
    });
    
    await service.save();
    console.log('New service created:', { name: service.name, rate: service.rate });
    res.status(201).json(service);
  } catch (err) {
    console.error('Failed to create service:', err);
    res.status(500).json({ message: 'Failed to create service', error: err.message });
  }
});

// Update service status (admin)
router.put('/services/:id', adminAuth, async (req, res) => {
  try {
    const { isActive } = req.body;
    const service = await Service.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true }
    );
    if (!service) return res.status(404).json({ message: 'Service not found' });
    res.json(service);
  } catch (err) {
    console.error('Failed to update service:', err);
    res.status(500).json({ message: 'Failed to update service' });
  }
});

// Update service price (admin)
router.put('/services/price/:serviceType/:serviceTitle', adminAuth, async (req, res) => {
  try {
    const { serviceType, serviceTitle } = req.params;
    const { price } = req.body;
    
    if (!price || isNaN(price) || price <= 0) {
      return res.status(400).json({ message: 'Valid price is required' });
    }
    
    // Find existing service price or create new one
    const servicePrice = await ServicePrice.findOneAndUpdate(
      { serviceType, serviceTitle },
      { 
        price: parseFloat(price),
        updatedBy: req.user.id,
        updatedAt: new Date()
      },
      { upsert: true, new: true }
    );
    
    console.log('Service price updated:', { serviceType, serviceTitle, price: servicePrice.price });
    
    res.json({ 
      message: 'Service price updated successfully',
      serviceType,
      serviceTitle,
      price: servicePrice.price
    });
  } catch (err) {
    console.error('Failed to update service price:', err);
    res.status(500).json({ message: 'Failed to update service price' });
  }
});

// Delete service (admin)
router.delete('/services/:serviceType/:serviceTitle', adminAuth, async (req, res) => {
  try {
    const { serviceType, serviceTitle } = req.params;
    
    // Deactivate the service price instead of deleting it
    const servicePrice = await ServicePrice.findOneAndUpdate(
      { serviceType, serviceTitle },
      { 
        isActive: false,
        updatedBy: req.user.id,
        updatedAt: new Date()
      },
      { new: true }
    );
    
    if (!servicePrice) {
      return res.status(404).json({ message: 'Service not found' });
    }
    
    console.log('Service deactivated:', { serviceType, serviceTitle });
    
    res.json({ 
      message: 'Service deleted successfully',
      serviceType,
      serviceTitle
    });
  } catch (err) {
    console.error('Failed to delete service:', err);
    res.status(500).json({ message: 'Failed to delete service' });
  }
});

// Get current admin profile
router.get('/profile', adminAuth, async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id).select('-password');
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    res.json(admin);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch admin profile' });
  }
});

// Update admin profile
router.put('/profile', adminAuth, async (req, res) => {
  try {
    const updates = {};
    if (req.body.name) updates.name = req.body.name;
    if (req.body.email) updates.email = req.body.email;
    // Optionally handle password change
    if (req.body.password) {
      updates.password = await bcrypt.hash(req.body.password, 10);
    }
    const admin = await Admin.findByIdAndUpdate(req.user.id, updates, { new: true, select: '-password' });
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    res.json(admin);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update admin profile' });
  }
});

export default router;
