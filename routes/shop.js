import express from 'express';
import Shop from '../models/Shop.js';
import { adminAuth } from '../middleware/auth.js';

const router = express.Router();

// ADMIN: Add a new shop
router.post('/', adminAuth, async (req, res) => {
  try {
    const { name, address, phone, owner } = req.body;
    if (!name || !address || !phone || !owner) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    const shop = await Shop.create({ name, address, phone, owner });
    res.status(201).json(shop);
  } catch (err) {
    res.status(500).json({ message: 'Failed to add shop', error: err.message });
  }
});

// CUSTOMER: Get all shops
router.get('/', async (req, res) => {
  try {
    const shops = await Shop.find();
    res.json(shops);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch shops', error: err.message });
  }
});

export default router;
