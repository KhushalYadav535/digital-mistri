import express from 'express';
import multer from 'multer';
import path from 'path';
import NearbyShop from '../models/NearbyShop.js';
import { adminAuth } from '../middleware/auth.js';
import { admin } from '../middleware/admin.js';

const router = express.Router();

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({ storage: storage });

// Admin: Create a new nearby shop
router.post('/', [adminAuth, admin, upload.single('image')], async (req, res) => {
  try {
    const {
      name,
      description,
      phone,
      email,
    } = req.body;

    // When using multipart/form-data, complex objects may be sent as JSON strings.
    // This handles both cases: if the field is a string, parse it; if it's an object, use it directly.
    const address = typeof req.body.address === 'string' ? JSON.parse(req.body.address) : req.body.address;
    const location = typeof req.body.location === 'string' ? JSON.parse(req.body.location) : req.body.location;
    const services = typeof req.body.services === 'string' ? JSON.parse(req.body.services) : req.body.services;
    const workingHours = typeof req.body.workingHours === 'string' ? JSON.parse(req.body.workingHours) : req.body.workingHours;
    
    let images = [];
    if (req.file) {
      images.push(`/uploads/${req.file.filename}`);
    }

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
        isNaN(parseFloat(location.coordinates[0])) ||
        isNaN(parseFloat(location.coordinates[1]))) {
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
      images,
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