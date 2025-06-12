import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';
import Worker from '../models/Worker.js';
import { adminAuth } from '../middleware/auth.js';

const router = express.Router();

// Admin Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });
    const token = jwt.sign({ id: admin._id, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.role } });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
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
    const workers = await Worker.find();
    res.json(workers);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch workers' });
  }
});

// Get single worker by ID (admin detail view)
router.get('/workers/:id', adminAuth, async (req, res) => {
  try {
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
    if (exists) return res.status(400).json({ message: 'Worker already exists' });
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
      isVerified: false,
      services: [],
      stats: {},
    });
    await worker.save();
    console.log('Worker created:', { name, email, phone });
    res.status(201).json(worker);
  } catch (err) {
    res.status(500).json({ message: 'Failed to add worker' });
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
