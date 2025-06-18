import express from 'express';
import Service from '../models/Service.js';
import { adminAuth } from '../middleware/auth.js';

const router = express.Router();

// Admin: Add a new service
router.post('/', adminAuth, async (req, res) => {
  try {
    const { name, description, rate } = req.body;
    if (!name || !rate) {
      return res.status(400).json({ message: 'Name and rate are required' });
    }
    const service = new Service({ name, description, rate });
    await service.save();
    res.status(201).json(service);
  } catch (err) {
    res.status(500).json({ message: 'Failed to add service', error: err.message });
  }
});

// Get all services (public)
router.get('/', async (req, res) => {
  try {
    const services = await Service.find().sort({ createdAt: -1 });
    res.json(services);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch services', error: err.message });
  }
});

export default router;
