import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Worker from '../models/Worker.js';

const router = express.Router();

// Worker Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  console.log('Worker login request:', req.body);
  try {
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    const worker = await Worker.findOne({ email });
    if (!worker) {
      console.log('Worker not found:', email);
      return res.status(404).json({ message: 'Worker not found' });
    }
    // Password is the worker's phone (hashed in DB)
    const isMatch = await bcrypt.compare(password, worker.password);
    if (!isMatch) {
      console.log('Invalid credentials for worker:', email);
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: worker._id, role: 'worker' }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, worker: { id: worker._id, name: worker.name, email: worker.email, phone: worker.phone } });
  } catch (err) {
    console.error('Worker login error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// JWT Authentication middleware

const auth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ message: 'No token provided' });
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user;
    next();
  });
};

// GET /api/worker/profile (allow with or without trailing slash)
router.get(['/profile', '/profile/'], auth, async (req, res) => {
  console.log('GET /api/worker/profile called', req.headers);
  try {
    const worker = await Worker.findById(req.user.id);
    if (!worker) return res.status(404).json({ message: 'Worker not found' });
    res.json({
      id: worker._id,
      name: worker.name,
      email: worker.email,
      phone: worker.phone,
      services: worker.services || [],
      totalBookings: worker.stats?.totalBookings || 0,
      completedBookings: worker.stats?.completedBookings || 0,
      totalEarnings: worker.stats?.totalEarnings || 0,
      isVerified: worker.isVerified,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

export default router;
