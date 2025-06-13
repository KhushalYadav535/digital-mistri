import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Customer from '../models/Customer.js';
import { customerAuth } from '../middleware/auth.js';

const router = express.Router();

// Register new customer
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password, address } = req.body;
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    const existing = await Customer.findOne({ email });
    if (existing) return res.status(409).json({ message: 'Email already registered' });
    const hashed = await bcrypt.hash(password, 10);
    const customer = await Customer.create({ name, email, phone, password: hashed, address });
    // Generate token
    const token = jwt.sign({ id: customer._id, role: 'customer' }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: customer._id, name, email, phone, address, role: 'customer' } });
  } catch (err) {
    res.status(500).json({ message: 'Registration failed', error: err.message });
  }
});

// Login customer
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Missing credentials' });
    const customer = await Customer.findOne({ email });
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    const valid = await bcrypt.compare(password, customer.password);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' });
    const token = jwt.sign({ id: customer._id, role: 'customer' }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: customer._id, name: customer.name, email, phone: customer.phone, address: customer.address, role: 'customer' } });
  } catch (err) {
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
