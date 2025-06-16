import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Customer from '../models/Customer.js';
import { customerAuth } from '../middleware/auth.js';

const router = express.Router();

// Register new customer
router.post('/register', async (req, res) => {
  try {
    console.log('Register request body:', req.body); // Debug log
    
    // Validate required fields
    const { name, email, phone, password, address } = req.body;
    
    // Check for missing fields
    const missingFields = [];
    if (!name) missingFields.push('name');
    if (!email) missingFields.push('email');
    if (!phone) missingFields.push('phone');
    if (!password) missingFields.push('password');
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        message: 'Missing required fields', 
        fields: missingFields 
      });
    }

    // Validate email format
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        message: 'Invalid email format',
        errors: ['Please enter a valid email address']
      });
    }

    // Validate phone format
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ 
        message: 'Invalid phone number',
        errors: ['Phone number must be 10 digits']
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({ 
        message: 'Invalid password',
        errors: ['Password must be at least 6 characters long']
      });
    }

    // Check if email already exists
    const existingCustomer = await Customer.findOne({ email: email.toLowerCase() });
    if (existingCustomer) {
      return res.status(409).json({ 
        message: 'Email already registered',
        errors: ['This email is already registered']
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new customer
    const customer = new Customer({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      password: hashedPassword,
      address: address ? address.trim() : undefined
    });

    // Save customer
    await customer.save();

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: customer._id, 
        role: 'customer',
        email: customer.email 
      }, 
      process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );

    // Update last login
    customer.lastLogin = new Date();
    await customer.save();

    console.log('Customer registered successfully:', customer.email);

    // Return success response
    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: customer._id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        role: 'customer'
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    
    // Handle specific error types
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        message: 'Validation error',
        errors
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({
        message: 'Email already registered',
        errors: ['This email is already registered']
      });
    }

    // Generic error response
    res.status(500).json({
      message: 'Registration failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
    });
  }
});

// Login customer
router.post('/login', async (req, res) => {
  try {
    console.log('Login request body:', req.body); // Debug log
    const { email, password } = req.body;
    if (!email || !password) {
      console.log('Missing credentials');
      return res.status(400).json({ message: 'Missing credentials' });
    }
    const customer = await Customer.findOne({ email });
    if (!customer) {
      console.log('Customer not found:', email);
      return res.status(404).json({ message: 'Customer not found' });
    }
    const valid = await bcrypt.compare(password, customer.password);
    if (!valid) {
      console.log('Invalid credentials for:', email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: customer._id, role: 'customer' }, process.env.JWT_SECRET, { expiresIn: '7d' });
    console.log('Customer logged in:', email);
    res.json({ token, user: { id: customer._id, name: customer.name, email, phone: customer.phone, address: customer.address, role: 'customer' } });
  } catch (err) {
    console.log('Login error:', err);
    res.status(500).json({ message: 'Login failed', error: err.message });
  }
});

// Get customer profile
router.get('/profile', customerAuth, async (req, res) => {
  try {
    const customer = await Customer.findById(req.user.id).select('-password');
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    res.json(customer);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch profile', error: err.message });
  }
});

// Update customer profile
router.put('/profile', customerAuth, async (req, res) => {
  try {
    const updates = (({ name, phone, address }) => ({ name, phone, address }))(req.body);
    const customer = await Customer.findByIdAndUpdate(req.user.id, updates, { new: true }).select('-password');
    res.json(customer);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update profile', error: err.message });
  }
});

// Change password
router.put('/change-password', customerAuth, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) return res.status(400).json({ message: 'Missing fields' });
    const customer = await Customer.findById(req.user.id);
    const valid = await bcrypt.compare(oldPassword, customer.password);
    if (!valid) return res.status(401).json({ message: 'Incorrect old password' });
    customer.password = await bcrypt.hash(newPassword, 10);
    await customer.save();
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to change password', error: err.message });
  }
});

export default router;
