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
  console.log('=== Booking Request Started ===');
  console.log('Request Headers:', req.headers);
  console.log('Request Body:', JSON.stringify(req.body, null, 2));
  
  try {
    const { 
      serviceType, 
      serviceTitle, 
      bookingDate, 
      bookingTime, 
      address,
      phone 
    } = req.body;
    const customerId = req.user.id;

    console.log('=== Validation Phase ===');
    console.log('Validating required fields...');
    if (!serviceType || !serviceTitle || !address || !bookingDate || !bookingTime || !phone) {
      console.error('Validation failed:', { 
        serviceType, serviceTitle, address, bookingDate, bookingTime, phone
      });
      return res.status(400).json({ 
        message: 'Missing required fields',
        required: ['serviceType', 'serviceTitle', 'address', 'bookingDate', 'bookingTime', 'phone']
      });
    }

    console.log('Validating address structure...');
    if (!address.street || !address.city || !address.state || !address.pincode) {
      console.error('Invalid address structure:', address);
      return res.status(400).json({ 
        message: 'Invalid address structure',
        required: ['street', 'city', 'state', 'pincode']
      });
    }

    console.log('Validating date format...');
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(bookingDate)) {
      console.error('Invalid date format:', bookingDate);
      return res.status(400).json({ 
        message: 'Invalid date format. Please use YYYY-MM-DD'
      });
    }

    console.log('Validating time format...');
    const timeRegex = /^(?:[01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(bookingTime)) {
      console.error('Invalid time format:', bookingTime);
      return res.status(400).json({ 
        message: 'Invalid time format. Please use HH:MM'
      });
    }

    console.log('Validating phone number...');
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(phone)) {
      console.error('Invalid phone number:', phone);
      return res.status(400).json({ 
        message: 'Invalid phone number. Please enter a 10-digit number'
      });
    }

    // Find available worker for the service type
    console.log('Finding available worker for service:', serviceType);
    const worker = await Worker.findOne({
      isAvailable: true,
      services: serviceType,
      isVerified: true
    });

    const bookingData = {
      customer: customerId,
      serviceType,
      serviceTitle,
      bookingDate: new Date(bookingDate),
      bookingTime,
      address,
      phone,
      status: worker ? 'Worker Assigned' : 'Pending',
      worker: worker ? worker._id : undefined,
      assignedAt: worker ? new Date() : undefined
    };

    try {
      console.log('Attempting to save booking...');
      const booking = await Booking.create(bookingData);
      console.log('Booking created successfully:', {
        bookingId: booking._id,
        status: booking.status,
        workerId: booking.worker
      });

      // If worker is assigned, create notifications
      if (worker) {
        console.log('Creating notifications...');
        
        // Create notification for worker
        await Notification.create({
          type: 'booking_assigned',
          user: worker._id,
          userModel: 'Worker',
          booking: booking._id,
          message: `New booking assigned for service: ${serviceTitle}`
        });

        // Create notification for customer
        await Notification.create({
          type: 'worker_assigned',
          user: customerId,
          userModel: 'Customer',
          booking: booking._id,
          message: `A worker has been assigned to your booking for ${serviceTitle}`
        });

        // Send push notification to worker
        if (worker.fcmToken) {
          await sendPushNotification({
            token: worker.fcmToken,
            title: 'New Booking Assigned',
            body: `You have been assigned a new booking for ${serviceTitle}`,
            data: {
              type: 'booking_assigned',
              bookingId: booking._id.toString()
            }
          });
        }

        // Send push notification to customer
        const customer = await Customer.findById(customerId);
        if (customer?.fcmToken) {
          await sendPushNotification({
            token: customer.fcmToken,
            title: 'Worker Assigned',
            body: `A worker has been assigned to your booking for ${serviceTitle}`,
            data: {
              type: 'worker_assigned',
              bookingId: booking._id.toString()
            }
          });
        }

        console.log('Updating worker stats...');
        await Worker.findByIdAndUpdate(worker._id, {
          $inc: { 'stats.totalBookings': 1 }
        });

        console.log('Worker assignment complete:', {
          workerId: worker._id,
          workerEmail: worker.email,
          bookingId: booking._id,
          serviceType
        });
      }

      console.log('=== Booking Process Complete ===');
      return res.status(201).json(booking);
    } catch (createError) {
      console.error('=== Database Error ===');
      console.error('Error creating booking:', {
        error: createError,
        name: createError.name,
        message: createError.message,
        stack: createError.stack
      });
      
      if (createError.name === 'ValidationError') {
        console.error('Validation errors:', createError.errors);
        return res.status(400).json({ 
          message: 'Validation error',
          errors: createError.errors
        });
      }

      if (createError.code === 11000) {
        console.error('Duplicate booking error:', createError);
        return res.status(400).json({ 
          message: 'Duplicate booking',
          error: createError.message
        });
      }

      return res.status(500).json({ 
        message: 'Failed to save booking',
        error: createError.message
      });
    }
  } catch (err) {
    console.error('=== Unexpected Error ===');
    console.error('Booking creation error:', {
      error: err,
      name: err.name,
      message: err.message,
      stack: err.stack
    });
    
    return res.status(500).json({ 
      message: 'Booking failed',
      error: err.message 
    });
  } finally {
    console.log('=== Booking Request Finished ===');
  }
});

// Get customer's bookings
router.get('/customer', customerAuth, async (req, res) => {
  try {
    const bookings = await Booking.find({ customer: req.user.id })
      .populate('worker', 'name phone')
      .sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err) {
    console.error('Error fetching customer bookings:', err);
    res.status(500).json({ message: 'Failed to fetch bookings', error: err.message });
  }
});

// Get worker's assigned bookings
router.get('/worker', workerAuth, async (req, res) => {
  try {
    const bookings = await Booking.find({
      worker: req.user.id,
      status: { $in: ['Worker Assigned', 'Accepted', 'In Progress'] }
    })
    .populate('customer', 'name phone')
    .sort({ createdAt: -1 });
    
    console.log('Found bookings for worker:', {
      workerId: req.user.id,
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

// Worker accept booking
router.post('/:id/accept', workerAuth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.worker.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    if (booking.status !== 'Worker Assigned') {
      return res.status(400).json({ message: 'Invalid booking status' });
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
    if (customer?.fcmToken) {
      await sendPushNotification({
        token: customer.fcmToken,
        title: 'Booking Accepted',
        body: `Your booking for ${booking.serviceTitle} has been accepted`,
        data: {
          type: 'booking_accepted',
          bookingId: booking._id.toString()
        }
      });
    }

    res.json({ message: 'Booking accepted successfully' });
  } catch (err) {
    console.error('Error accepting booking:', err);
    res.status(500).json({ message: 'Failed to accept booking', error: err.message });
  }
});

// Worker reject booking
router.post('/:id/reject', workerAuth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.worker.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    if (booking.status !== 'Worker Assigned') {
      return res.status(400).json({ message: 'Invalid booking status' });
    }

    await Booking.findByIdAndUpdate(req.params.id, {
      status: 'Rejected',
      worker: null,
      assignedAt: null
    });

    // Create notification for customer
    await Notification.create({
      type: 'booking_rejected',
      user: booking.customer,
      userModel: 'Customer',
      booking: booking._id,
      message: `Your booking for ${booking.serviceTitle} has been rejected by the worker`
    });

    // Send push notification to customer
    const customer = await Customer.findById(booking.customer);
    if (customer?.fcmToken) {
      await sendPushNotification({
        token: customer.fcmToken,
        title: 'Booking Rejected',
        body: `Your booking for ${booking.serviceTitle} has been rejected`,
        data: {
          type: 'booking_rejected',
          bookingId: booking._id.toString()
        }
      });
    }

    res.json({ message: 'Booking rejected successfully' });
  } catch (err) {
    console.error('Error rejecting booking:', err);
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

// Get single booking by ID
router.get('/:id', customerAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate booking ID
    if (!id || id === 'undefined') {
      return res.status(400).json({ message: 'Invalid booking ID' });
    }

    const booking = await Booking.findById(id)
      .populate('worker', 'name phone')
      .populate('customer', 'name phone');
    
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Check if the booking belongs to the customer
    if (booking.customer._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    res.json(booking);
  } catch (err) {
    console.error('Error fetching booking:', err);
    res.status(500).json({ message: 'Failed to fetch booking', error: err.message });
  }
});

export default router;
