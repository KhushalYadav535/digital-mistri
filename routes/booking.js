import express from 'express';
import Booking from '../models/Booking.js';
import Customer from '../models/Customer.js';
import Worker from '../models/Worker.js';
import { customerAuth } from '../middleware/auth.js';
import Notification from '../models/Notification.js';

const router = express.Router();

// Create a new booking (customer)
router.post('/', customerAuth, async (req, res) => {
  try {
    const { serviceType, serviceTitle, address, phone } = req.body;
    const customer = req.user.id;

    // DEBUG: Log incoming booking request
    console.log('Creating booking:', { customer, serviceType, serviceTitle, address, phone });

    // Find first available worker for the requested serviceType (case-insensitive)
    const worker = await Worker.findOne({ 
      services: { $elemMatch: { $regex: new RegExp(`^${serviceType}$`, 'i') } },
      isAvailable: true // Only find available workers
    });
    
    if (!worker) {
      console.warn('No worker found for serviceType:', serviceType);
    } else {
      console.log('Worker assigned:', worker.email, worker.services);
    }

    const booking = await Booking.create({
      customer,
      serviceType,
      serviceTitle,
      address,
      phone,
      status: worker ? 'Worker Assigned' : 'Pending',
      worker: worker ? worker._id : undefined,
    });

    // If worker is assigned, create a notification for them
    if (worker) {
      await Notification.create({
        type: 'booking_assigned',
        user: worker._id,
        userModel: 'Worker',
        booking: booking._id,
        message: `New booking assigned for service: ${serviceTitle}`
      });
    }

    res.status(201).json(booking);
  } catch (err) {
    console.error('Booking creation error:', err);
    res.status(500).json({ message: 'Booking failed', error: err.message });
  }
});

// Get booking status (customer)
router.get('/:id', customerAuth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('worker', 'name phone');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.customer.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch booking', error: err.message });
  }
});

// Worker: Get assigned bookings
router.get('/worker/:workerId', async (req, res) => {
  try {
    const bookings = await Booking.find({ 
      worker: req.params.workerId,
      status: { $in: ['Worker Assigned', 'Accepted', 'In Progress'] }
    }).populate('customer', 'name phone');
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch bookings', error: err.message });
  }
});

// Admin: Get all bookings
router.get('/admin/all', async (req, res) => {
  try {
    const bookings = await Booking.find().populate('customer', 'name phone').populate('worker', 'name phone');
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch bookings', error: err.message });
  }
});

// Update booking status (worker/admin)
router.put('/:id/status', async (req, res) => {
  try {
    const { status, workerId } = req.body;
    const update = { status };
    if (workerId) update.worker = workerId;
    const booking = await Booking.findByIdAndUpdate(req.params.id, update, { new: true });
    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update booking', error: err.message });
  }
});

export default router;
