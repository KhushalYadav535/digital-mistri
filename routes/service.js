import express from 'express';
import Service from '../models/Service.js';
import ServicePrice from '../models/ServicePrice.js';
import { adminAuth } from '../middleware/auth.js';

const router = express.Router();

// Admin: Add a new service
router.post('/', adminAuth, async (req, res) => {
  try {
    const { name, description, rate, category } = req.body;
    if (!name || !rate) {
      return res.status(400).json({ message: 'Name and rate are required' });
    }
    
    // Check if service already exists
    const existingService = await Service.findOne({ name: name.toLowerCase() });
    if (existingService) {
      return res.status(409).json({ message: 'Service already exists' });
    }
    
    const service = new Service({ 
      name: name.toLowerCase(), 
      description, 
      rate: Number(rate),
      category: category || 'General'
    });
    await service.save();
    res.status(201).json(service);
  } catch (err) {
    res.status(500).json({ message: 'Failed to add service', error: err.message });
  }
});

// Get all services (public)
router.get('/', async (req, res) => {
  try {
    const services = await Service.find({ isActive: true }).sort({ createdAt: -1 });
    res.json(services);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch services', error: err.message });
  }
});

// Get all service prices (public)
router.get('/prices', async (req, res) => {
  try {
    const servicePrices = await ServicePrice.find({ isActive: true }).sort({ updatedAt: -1 });
    res.json(servicePrices);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch service prices', error: err.message });
  }
});

// Get service by name/type (public)
router.get('/:name', async (req, res) => {
  try {
    const service = await Service.findOne({ 
      name: req.params.name.toLowerCase(),
      isActive: true 
    });
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }
    res.json(service);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch service', error: err.message });
  }
});

// Get services by category (public)
router.get('/category/:category', async (req, res) => {
  try {
    const services = await Service.find({ 
      category: req.params.category,
      isActive: true 
    }).sort({ name: 1 });
    res.json(services);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch services', error: err.message });
  }
});

// Admin: Update service
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const { name, description, rate, category, isActive } = req.body;
    const updateData = {};
    
    if (name) updateData.name = name.toLowerCase();
    if (description !== undefined) updateData.description = description;
    if (rate !== undefined) updateData.rate = Number(rate);
    if (category) updateData.category = category;
    if (isActive !== undefined) updateData.isActive = isActive;
    
    const service = await Service.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );
    
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }
    
    res.json(service);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update service', error: err.message });
  }
});

// Admin: Delete service
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const service = await Service.findByIdAndDelete(req.params.id);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }
    res.json({ message: 'Service deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete service', error: err.message });
  }
});

// Get service categories (public)
router.get('/categories/list', async (req, res) => {
  try {
    const categories = await Service.distinct('category');
    res.json(categories);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch categories', error: err.message });
  }
});

export default router;
