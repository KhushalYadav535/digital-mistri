import express from 'express';
import Booking from '../models/Booking.js';
import Customer from '../models/Customer.js';
import Worker from '../models/Worker.js';
import { customerAuth, workerAuth } from '../middleware/auth.js';
import Notification from '../models/Notification.js';
import { sendPushNotification } from '../utils/notifications.js';

const router = express.Router();

// Create a new booking (customer)
router.post('/', customerAuth, async (req, res) => {
  try {
    const { service, subService, bookingDate, bookingTime, address } = req.body;
    const customerId = req.user.id;

    // Get customer profile
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: 'Customer profile not found' });
    }

    // Extract service type and title from service object
    const serviceType = service.name.toLowerCase();
    const serviceTitle = subService;

    // Format address
    const formattedAddress = `${address.street}, ${address.city}, ${address.state} - ${address.pincode}`;
    const phone = customer.phone; // Get phone from customer's profile

    // DEBUG: Log incoming booking request
    console.log('Creating booking:', { customerId, serviceType, serviceTitle, formattedAddress, phone });

    // Find first available worker for the requested serviceType (case-insensitive)
    const worker = await Worker.findOne({ 
      services: { $regex: new RegExp(serviceType, 'i') },
      isAvailable: true,
      isVerified: true
    });
    
    if (!worker) {
      console.warn('No worker found for serviceType:', serviceType);
    } else {
      console.log('Worker assigned:', worker.email, worker.services);
    }

    const booking = await Booking.create({
      customer: customerId,
      serviceType,
      serviceTitle,
      address: formattedAddress,
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

      // Update worker's stats
      await Worker.findByIdAndUpdate(worker._id, {
        $inc: { 'stats.totalBookings': 1 }
      });

      console.log('Booking assigned to worker:', {
        workerId: worker._id,
        workerEmail: worker.email,
        bookingId: booking._id,
        serviceType
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
    const booking = await Booking.findById(req.params.id)
      .populate('worker', 'name phone')
      .populate('customer', 'name phone');
    
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.customer.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch booking', error: err.message });
  }
});

// Worker accept booking
router.post('/:id/accept', workerAuth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.worker.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    if (booking.status !== 'Worker Assigned') {
      return res.status(400).json({ message: 'Booking cannot be accepted' });
    }

    await Booking.findByIdAndUpdate(req.params.id, {
      status: 'Accepted',
      acceptedAt: new Date()
    });

    // Create notification for customer
    await Notification.create({
      type: 'booking_accepted',
      user: booking.customer,
      userModel: 'Customer',
      booking: booking._id,
      message: `Your booking for ${booking.serviceTitle} has been accepted by the worker`
    });

    // Send push notification to customer
    const customer = await Customer.findById(booking.customer);
    if (customer && customer.expoPushToken) {
      await sendPushNotification(customer.expoPushToken, {
        title: 'Booking Accepted',
        body: `Your booking for ${booking.serviceTitle} has been accepted`
      });
    }

    res.json({ message: 'Booking accepted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to accept booking', error: err.message });
  }
});

// Worker reject booking
router.post('/:id/reject', workerAuth, async (req, res) => {
  try {
    const { reason } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.worker.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    if (booking.status !== 'Worker Assigned') {
      return res.status(400).json({ message: 'Booking cannot be rejected' });
    }

    await Booking.findByIdAndUpdate(req.params.id, {
      status: 'Rejected',
      rejectedAt: new Date(),
      cancellationReason: reason
    });

    // Create notification for customer
    await Notification.create({
      type: 'booking_rejected',
      user: booking.customer,
      userModel: 'Customer',
      booking: booking._id,
      message: `Your booking for ${booking.serviceTitle} has been rejected by the worker: ${reason}`
    });

    // Send push notification to customer
    const customer = await Customer.findById(booking.customer);
    if (customer && customer.expoPushToken) {
      await sendPushNotification(customer.expoPushToken, {
        title: 'Booking Rejected',
        body: `Your booking for ${booking.serviceTitle} has been rejected: ${reason}`
      });
    }

    // Reassign the booking to another worker
    const newWorker = await Worker.findOne({ 
      services: { $regex: new RegExp(booking.serviceType, 'i') },
      isAvailable: true,
      isVerified: true,
      _id: { $ne: booking.worker }
    });

    if (newWorker) {
      await Booking.findByIdAndUpdate(req.params.id, {
        worker: newWorker._id,
        status: 'Worker Assigned'
      });

      // Notify new worker
      await Notification.create({
        type: 'booking_assigned',
        user: newWorker._id,
        userModel: 'Worker',
        booking: booking._id,
        message: `New booking assigned for service: ${booking.serviceTitle}`
      });
    }

    res.json({ message: 'Booking rejected successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to reject booking', error: err.message });
  }
});

// Admin get all bookings
router.get('/admin', async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate('worker', 'name phone')
      .populate('customer', 'name phone')
      .sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch bookings', error: err.message });
  }
});

// Worker: Get assigned bookings
router.get('/worker/:workerId', async (req, res) => {
  try {
    console.log('Fetching bookings for worker:', req.params.workerId);
    
    const bookings = await Booking.find({ 
      worker: req.params.workerId,
      status: { $in: ['Worker Assigned', 'Accepted', 'In Progress'] }
    })
    .populate('customer', 'name phone')
    .sort({ createdAt: -1 }); // Most recent first
    
    console.log('Found bookings for worker:', {
      workerId: req.params.workerId,
      count: bookings.length,
      bookings: bookings.map(b => ({
        id: b._id,
        status: b.status,
        serviceType: b.serviceType
      }))
    });
    
    res.json(bookings);
  } catch (err) {
    console.error('Error fetching worker bookings:', err);
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
