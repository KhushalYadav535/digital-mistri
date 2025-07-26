import express from 'express';
import NearbyShop from '../models/NearbyShop.js';
import { adminAuth } from '../middleware/auth.js';
import { admin } from '../middleware/admin.js';
import { customerAuth } from '../middleware/auth.js';
import { upload } from '../utils/cloudinary.js';
import PendingShop from '../models/PendingShop.js';

const router = express.Router();

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
      // Cloudinary returns the optimized URL directly
      images.push(req.file.path);
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
router.post('/:id/reviews', customerAuth, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const shop = await NearbyShop.findById(req.params.id);
    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }
    // Prevent duplicate reviews by same customer
    const alreadyReviewed = shop.reviews.some(r => r.user && r.user.toString() === req.user.id);
    if (alreadyReviewed) {
      return res.status(400).json({ message: 'You have already reviewed this shop.' });
    }
    shop.reviews.push({ user: req.user.id, rating, comment });
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

// Customer: Create a new nearby shop (auto-approved after payment)
router.post('/customer', [customerAuth, upload.single('image')], async (req, res) => {
  try {
    const {
      name,
      description,
      phone,
      email,
    } = req.body;

    const address = typeof req.body.address === 'string' ? JSON.parse(req.body.address) : req.body.address;
    const location = typeof req.body.location === 'string' ? JSON.parse(req.body.location) : req.body.location;
    const services = typeof req.body.services === 'string' ? JSON.parse(req.body.services) : req.body.services;
    const workingHours = typeof req.body.workingHours === 'string' ? JSON.parse(req.body.workingHours) : req.body.workingHours;
    
    let images = [];
    if (req.file) {
      // Cloudinary returns the optimized URL directly
      images.push(req.file.path);
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
      isActive: true // auto-approved
    });

    res.status(201).json(shop);
  } catch (err) {
    console.error('Error creating nearby shop (customer):', err);
    res.status(500).json({ message: 'Failed to create nearby shop', error: err.message });
  }
});

// Customer: Initiate payment for new nearby shop
router.post('/customer-payment', customerAuth, async (req, res) => {
  try {
    const { shopData, amount } = req.body;
    if (!shopData || !amount) {
      return res.status(400).json({ message: 'Shop data and amount are required' });
    }
    const shop = typeof shopData === 'string' ? JSON.parse(shopData) : shopData;
    const orderId = `SHOP_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const customerName = shop.name || 'Customer';
    const customerPhone = shop.phone || '0000000000';
    const customerEmail = shop.email || 'noemail@nomail.com';
    const returnUrl = `${process.env.CASHFREE_RETURN_URL || 'https://yourdomain.com/payment-success'}?order_id=${orderId}`;
    // Save pending shop data in DB
    await PendingShop.create({ orderId: orderId, shopData: shop, amount });
    res.json({
      paymentLink: 'https://api.cashfree.com/v2/cftoken/order', // Placeholder for actual payment link
      orderId: orderId,
      shopData: shop,
      amount
    });
  } catch (err) {
    console.error('Error creating shop payment:', err);
    res.status(500).json({ message: 'Failed to create shop payment', error: err.message });
  }
});

// Cashfree webhook for shop payment
router.post('/customer-payment/webhook', async (req, res) => {
  try {
    // This webhook handler is no longer needed as Cashfree integration is removed.
    // Keeping it for now, but it will not be called by Cashfree.
    console.log('Cashfree webhook received (no longer used)');
    return res.json({ success: true });
  } catch (err) {
    console.error('Shop payment webhook error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router; 