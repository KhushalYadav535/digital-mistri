import express from 'express';
import NearbyShop from '../models/NearbyShop.js';
import { adminAuth } from '../middleware/auth.js';
import { admin } from '../middleware/admin.js';

const router = express.Router();

// Admin: Create a new nearby shop
router.post('/', [adminAuth, admin], async (req, res) => {
  try {
    const {
      name,
      description,
      address,
      location,
      phone,
      email,
      services,
      workingHours,
      images
    } = req.body;

    // Validate address fields
    if (!address || !address.street || !address.city || !address.state || !address.pincode) {
      return res.status(400).json({
        message: 'Invalid address. Please provide street, city, state, and pincode'
      });
    }

    // Validate location coordinates
    if (!location || !location.coordinates || 
        !Array.isArray(location.coordinates) || 
        location.coordinates.length !== 2 ||
        typeof location.coordinates[0] !== 'number' ||
        typeof location.coordinates[1] !== 'number' ||
        isNaN(location.coordinates[0]) ||
        isNaN(location.coordinates[1])) {
      return res.status(400).json({ 
        message: 'Invalid location coordinates. Must provide [longitude, latitude] as numbers' 
      });
    }

    const shop = await NearbyShop.create({
      name,
      description,
      address,
      location: {
        type: 'Point',
        coordinates: [
          parseFloat(location.coordinates[0]),
          parseFloat(location.coordinates[1])
        ]
      },
      phone,
      email,
      services,
      workingHours,
      images
    });

    res.status(201).json(shop);
  } catch (err) {
    console.error('Error creating nearby shop:', err);
    res.status(500).json({ message: 'Failed to create nearby shop', error: err.message });
  }
});

// Admin: Update a nearby shop
router.put('/:id', [adminAuth, admin], async (req, res) => {
  try {
    const shop = await NearbyShop.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: Date.now() },
      { new: true }
    );

    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    res.json(shop);
  } catch (err) {
    console.error('Error updating nearby shop:', err);
    res.status(500).json({ message: 'Failed to update nearby shop', error: err.message });
  }
});

// Admin: Delete a nearby shop
router.delete('/:id', [adminAuth, admin], async (req, res) => {
  try {
    const shop = await NearbyShop.findByIdAndDelete(req.params.id);

    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    res.json({ message: 'Shop deleted successfully' });
  } catch (err) {
    console.error('Error deleting nearby shop:', err);
    res.status(500).json({ message: 'Failed to delete nearby shop', error: err.message });
  }
});

// Get all nearby shops
router.get('/', async (req, res) => {
  try {
    const { latitude, longitude, radius } = req.query;
    let query = {};

    if (latitude && longitude && radius) {
      query = {
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [parseFloat(longitude), parseFloat(latitude)]
            },
            $maxDistance: parseInt(radius) * 1000 // Convert km to meters
          }
        }
      };
    }

    const shops = await NearbyShop.find(query);
    res.json(shops);
  } catch (err) {
    console.error('Error fetching nearby shops:', err);
    res.status(500).json({ message: 'Failed to fetch nearby shops', error: err.message });
  }
});

// Get a single nearby shop
router.get('/:id', async (req, res) => {
  try {
    const shop = await NearbyShop.findById(req.params.id);

    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    res.json(shop);
  } catch (err) {
    console.error('Error fetching nearby shop:', err);
    res.status(500).json({ message: 'Failed to fetch nearby shop', error: err.message });
  }
});

// Add a review to a shop
router.post('/:id/reviews', adminAuth, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const shop = await NearbyShop.findById(req.params.id);

    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    shop.reviews.push({ rating, comment });
    
    // Update average rating
    const totalRating = shop.reviews.reduce((sum, review) => sum + review.rating, 0);
    shop.rating = totalRating / shop.reviews.length;

    await shop.save();
    res.json(shop);
  } catch (err) {
    console.error('Error adding review:', err);
    res.status(500).json({ message: 'Failed to add review', error: err.message });
  }
});

export default router; 