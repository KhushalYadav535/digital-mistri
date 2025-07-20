import express from 'express';
import Booking from '../models/Booking.js';
import Customer from '../models/Customer.js';
import Worker from '../models/Worker.js';
import { customerAuth, workerAuth, adminAuth } from '../middleware/auth.js';
import Notification from '../models/Notification.js';
import { sendPushNotification, sendRealTimeNotification } from '../utils/notifications.js';
import nodemailer from 'nodemailer';
import { sendOtpEmail } from '../utils/emailConfig.js';
import Job from '../models/Job.js'; // Ensure this is at the top

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
      phone,
      amount // <-- Add amount from req.body
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

    // Calculate amount from service if not provided
    let finalAmount = amount;
    if (!finalAmount || finalAmount <= 0) {
      try {
        const Service = await import('../models/Service.js').then(mod => mod.default);
        const service = await Service.findOne({ name: serviceTitle });
        if (service) {
          finalAmount = service.rate;
          console.log('Amount calculated from service rate:', finalAmount);
        } else {
          // Default amount if service not found
          finalAmount = 500; // Default amount
          console.log('Using default amount:', finalAmount);
        }
      } catch (serviceError) {
        console.warn('Could not fetch service rate, using default amount');
        finalAmount = 500; // Default amount
      }
    }

    // Create booking without assigning worker
    const bookingData = {
      customer: customerId,
      serviceType,
      serviceTitle,
      bookingDate: new Date(bookingDate),
      bookingTime,
      address,
      phone,
      amount: finalAmount, // <-- Add calculated amount to bookingData
      status: 'Pending'
    };

    try {
      console.log('Attempting to save booking...');
      const booking = await Booking.create(bookingData);
      console.log('Booking created successfully:', {
        bookingId: booking._id,
        status: booking.status,
        amount: booking.amount
      });

      // Find all available workers for this service type
      const availableWorkers = await Worker.find({
        services: serviceType,
        isVerified: true,
        isAvailable: true
      });

      // Create notification for customer
      await Notification.create({
        type: 'booking_created',
        user: customerId,
        userModel: 'Customer',
        title: 'Booking Created Successfully',
        message: `Your booking for ${serviceTitle} has been created and is pending worker assignment.`,
        data: { bookingId: booking._id.toString() },
        read: false
      });

      // Create notifications for all available workers
      await Promise.all(availableWorkers.map(worker => 
        Notification.create({
          type: 'new_booking_available',
          user: worker._id,
          userModel: 'Worker',
          title: 'New Booking Available',
          message: `A new booking is available for ${serviceTitle}`,
          data: { bookingId: booking._id.toString() },
          read: false
        })
      ));

      // Create notification for admin
      const Admin = await import('../models/Admin.js').then(mod => mod.default);
      const admins = await Admin.find();
      await Promise.all(admins.map(admin => 
        Notification.create({
          type: 'new_booking_available',
          user: admin._id,
          userModel: 'Admin',
          title: 'New Booking Created',
          message: `A new booking has been created for ${serviceTitle}`,
          data: { bookingId: booking._id.toString() },
          read: false
        })
      ));

      // Send push notifications to all available workers
      await Promise.all(availableWorkers.map(async worker => {
        if (worker.fcmToken) {
          await sendPushNotification({
            token: worker.fcmToken,
            title: 'New Booking Available',
            body: `A new booking is available for ${serviceTitle}`,
            data: {
              type: 'new_booking_available',
              bookingId: booking._id.toString()
            }
          });
        }
        sendRealTimeNotification(worker._id, {
          type: 'new_booking_available',
          message: `New booking available for service: ${serviceTitle}`,
          bookingId: booking._id.toString()
        });
      }));

      // Create corresponding job entry
      console.log('Creating corresponding job entry...');
      const job = await Job.create({
        service: serviceType,
        customer: customerId,
        candidateWorkers: availableWorkers.map(w => w._id),
        details: {
          amount: finalAmount,
          date: bookingDate,
          time: bookingTime,
          address,
          phone,
          serviceTitle
        },
        status: 'Pending',
        booking: booking._id // Link to the booking
      });
      console.log('Job created successfully:', job._id);

      console.log('=== Booking Process Complete ===');
      return res.status(201).json(booking);
    } catch (createError) {
      console.error('=== Database Error ===');
      console.error('Error creating booking:', createError);
      return res.status(500).json({ 
        message: 'Failed to save booking',
        error: createError.message
      });
    }
  } catch (err) {
    console.error('=== Unexpected Error ===');
    console.error('Booking creation error:', err);
    return res.status(500).json({ 
      message: 'Booking failed',
      error: err.message 
    });
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
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Check if booking is still pending
    if (booking.status !== 'Pending') {
      return res.status(400).json({ message: 'Booking is no longer available' });
    }

    // Check if worker is available and verified
    const worker = await Worker.findById(req.user.id);
    if (!worker.isAvailable || !worker.isVerified) {
      return res.status(400).json({ message: 'Worker is not available or not verified' });
    }

    // Check if worker provides this service
    if (!worker.services.includes(booking.serviceType)) {
      return res.status(400).json({ message: 'Worker does not provide this service' });
    }

    // Update booking with worker assignment
    booking.worker = req.user.id;
    booking.status = 'Worker Assigned';
    booking.assignedAt = new Date();
    await booking.save();
    // Update Job with assigned worker
    await Job.findOneAndUpdate(
      { 'details.bookingId': booking._id },
      { assignedWorker: req.user.id }
    );

    // Create notification for customer
    await Notification.create({
      type: 'worker_assigned',
      user: booking.customer,
      userModel: 'Customer',
      title: 'Worker Assigned',
      message: `A worker has been assigned to your booking for ${booking.serviceTitle}`,
      data: { bookingId: booking._id.toString() },
      read: false
    });

    // Create notification for admin
    const Admin = await import('../models/Admin.js').then(mod => mod.default);
    const admins = await Admin.find();
    await Promise.all(admins.map(admin => 
      Notification.create({
        type: 'worker_assigned',
        user: admin._id,
        userModel: 'Admin',
        title: 'Worker Assigned to Booking',
        message: `Worker assigned to booking for ${booking.serviceTitle}`,
        data: { bookingId: booking._id.toString() },
        read: false
      })
    ));
    sendRealTimeNotification(req.user.id, {
      type: 'booking_assigned',
      message: `You have been assigned a new booking for ${booking.serviceTitle}`,
      bookingId: booking._id.toString()
    });
    sendRealTimeNotification(booking.customer, {
      type: 'worker_assigned',
      message: `A worker has been assigned to your booking for ${booking.serviceTitle}`,
      bookingId: booking._id.toString()
    });

    // Send push notification to customer
    const customer = await Customer.findById(booking.customer);
    if (customer?.fcmToken) {
      await sendPushNotification({
        token: customer.fcmToken,
        title: 'Worker Assigned',
        body: `A worker has been assigned to your booking for ${booking.serviceTitle}`,
        data: {
          type: 'worker_assigned',
          bookingId: booking._id.toString()
        }
      });
    }

    res.json({ message: 'Booking accepted successfully', booking });
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

    // Unassign worker and set status to Pending so other workers can accept
    booking.status = 'Pending';
    booking.worker = null;
    booking.assignedAt = null;
    booking.acceptedAt = null;
    await booking.save();

    // Notify all available workers for this service type
    const availableWorkers = await Worker.find({
      services: booking.serviceType,
      isVerified: true,
      isAvailable: true
    });
    await Promise.all(availableWorkers.map(worker =>
      Notification.create({
        type: 'new_booking_available',
        user: worker._id,
        userModel: 'Worker',
        booking: booking._id,
        message: `A new booking is available for ${booking.serviceTitle}`
      })
    ));
    // (Optional) Send push notifications to workers
    await Promise.all(availableWorkers.map(async worker => {
      if (worker.fcmToken) {
        await sendPushNotification({
          token: worker.fcmToken,
          title: 'New Booking Available',
          body: `A new booking is available for ${booking.serviceTitle}`,
          data: {
            type: 'new_booking_available',
            bookingId: booking._id.toString()
          }
        });
      }
      sendRealTimeNotification(worker._id, {
        type: 'new_booking_available',
        message: `New booking available for service: ${booking.serviceTitle}`,
        bookingId: booking._id.toString()
      });
    }));

    // Create notification for customer
    await Notification.create({
      type: 'booking_rejected',
      user: booking.customer,
      userModel: 'Customer',
      booking: booking._id,
      message: `Your booking for ${booking.serviceTitle} has been rejected by the worker`
    });
    sendRealTimeNotification(booking.customer, {
      type: 'booking_rejected',
      message: `Your booking for ${booking.serviceTitle} has been rejected by the worker`,
      bookingId: booking._id.toString()
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
router.get('/admin', adminAuth, async (req, res) => {
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
router.get('/admin/all', adminAuth, async (req, res) => {
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
    
    // Get the booking before update to check if it's being completed
    const oldBooking = await Booking.findById(req.params.id);
    const booking = await Booking.findByIdAndUpdate(req.params.id, update, { new: true });
    
    // If booking is being marked as completed, update worker stats
    if (status === 'Completed' && booking.worker) {
      const Worker = await import('../models/Worker.js').then(mod => mod.default);
      const worker = await Worker.findById(booking.worker);
      if (worker) {
        // Get all worker's completed bookings
        const allWorkerBookings = await Booking.find({ worker: worker._id });
        const completedBookings = allWorkerBookings.filter(b => b.status === 'Completed').length;
        const totalEarnings = allWorkerBookings
          .filter(b => b.status === 'Completed')
          .reduce((sum, b) => sum + (b.amount || 0), 0);
        
        // Update worker stats
        worker.stats = {
          totalBookings: allWorkerBookings.length,
          completedBookings,
          totalEarnings,
          earnings: worker.stats?.earnings || []
        };
        
        // Add today's earnings
        const today = new Date().toISOString().split('T')[0];
        const existingEarningIndex = worker.stats.earnings.findIndex(e => e.date === today);
        if (existingEarningIndex >= 0) {
          worker.stats.earnings[existingEarningIndex].amount += booking.amount || 0;
        } else {
          worker.stats.earnings.push({
            date: today,
            amount: booking.amount || 0
          });
        }
        
        await worker.save();
      }
    }
    
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

// Cancel a booking (customer)
router.put('/:id/cancel', customerAuth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (String(booking.customer) !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to cancel this booking' });
    }
    if (['Completed', 'Cancelled', 'Rejected'].includes(booking.status)) {
      return res.status(400).json({ message: 'Booking cannot be cancelled' });
    }
    booking.status = 'Cancelled';
    booking.cancelledAt = new Date();
    booking.cancellationReason = req.body.reason || '';
    await booking.save();
    // Notify worker if assigned
    if (booking.worker) {
      await Notification.create({
        type: 'booking_cancelled',
        user: booking.worker,
        userModel: 'Worker',
        booking: booking._id,
        message: `Booking for ${booking.serviceTitle} was cancelled by customer.`
      });
    }
    // Notify customer
    await Notification.create({
      type: 'booking_cancelled',
      user: booking.customer,
      userModel: 'Customer',
      booking: booking._id,
      message: `Your booking for ${booking.serviceTitle} has been cancelled.`
    });

    // Notify admin
    const Admin = await import('../models/Admin.js').then(mod => mod.default);
    const admins = await Admin.find();
    await Promise.all(admins.map(admin => 
      Notification.create({
        type: 'booking_cancelled',
        user: admin._id,
        userModel: 'Admin',
        booking: booking._id,
        message: `Booking cancelled for ${booking.serviceTitle}`
      })
    ));
    res.json({ message: 'Booking cancelled successfully', booking });
  } catch (err) {
    res.status(500).json({ message: 'Failed to cancel booking', error: err.message });
  }
});

// Get booking status/details (customer)
router.get('/:id', customerAuth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('worker', 'name phone')
      .populate('customer', 'name phone email');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (String(booking.customer._id) !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to view this booking' });
    }
    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch booking details', error: err.message });
  }
});

// Customer notifications
router.get('/notifications/customer', customerAuth, async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user.id, userModel: 'Customer' })
      .sort({ createdAt: -1 });
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch notifications', error: err.message });
  }
});

// Helper to send OTP email
async function sendOtpEmailHelper(to, otp, serviceTitle) {
  try {
    await sendOtpEmail(to, otp, serviceTitle);
    console.log(`OTP email sent successfully to ${to}`);
  } catch (emailError) {
    console.error('Failed to send OTP email:', emailError);
    console.log(`Generated OTP for ${serviceTitle}: ${otp}`);
    console.log(`Customer email: ${to}`);
    // Don't throw error - OTP is still generated and stored
  }
}

// Worker requests completion: generate/send OTP
router.put('/:id/request-completion', workerAuth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('customer', 'email name');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (!booking.worker || String(booking.worker) !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    if (booking.status !== 'In Progress' && booking.status !== 'Worker Assigned' && booking.status !== 'Accepted' && booking.status !== 'in_progress') {
      return res.status(400).json({ message: 'Booking not in progress' });
    }
    
    // Log customer email for debugging
    console.log('Requesting completion for booking:', booking._id);
    console.log('Customer email:', booking.customer.email);
    
    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    booking.completionOtp = otp;
    booking.completionOtpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 min expiry
    await booking.save();
    
    // Send OTP to customer email
    await sendOtpEmailHelper(booking.customer.email, otp, booking.serviceTitle);
    
    // Check if email credentials are configured
    const emailConfigured = process.env.EMAIL_USER && process.env.EMAIL_PASS;
    
    if (emailConfigured) {
      res.json({ message: 'OTP sent to customer email' });
    } else {
      res.json({ 
        message: 'OTP generated successfully. Email not configured - check server logs for OTP.',
        otp: otp, // Include OTP in response for development/testing
        emailConfigured: false
      });
    }
  } catch (err) {
    console.error('Failed to request completion:', err);
    res.status(500).json({ message: 'Failed to request completion', error: err.message, stack: err.stack });
  }
});

// Worker verifies OTP to complete booking
router.put('/:id/verify-completion', workerAuth, async (req, res) => {
  try {
    const { otp } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (!booking.worker || String(booking.worker) !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    if (!booking.completionOtp || !booking.completionOtpExpires) {
      return res.status(400).json({ message: 'No OTP requested' });
    }
    if (booking.completionOtpExpires < new Date()) {
      return res.status(400).json({ message: 'OTP expired' });
    }
    // Debug logs for OTP comparison
    console.log('Booking.completionOtp:', booking.completionOtp);
    console.log('User entered OTP:', otp);
    console.log('Type booking.completionOtp:', typeof booking.completionOtp);
    console.log('Type user entered OTP:', typeof otp);
    if (String(booking.completionOtp) !== String(otp)) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }
    booking.status = 'Completed';
    booking.completedAt = new Date();
    booking.completionOtp = undefined;
    booking.completionOtpExpires = undefined;
    await booking.save();
    
    // Update worker stats
    const Worker = await import('../models/Worker.js').then(mod => mod.default);
    const worker = await Worker.findById(booking.worker);
    if (worker) {
      // Get all worker's completed bookings
      const allWorkerBookings = await Booking.find({ worker: worker._id });
      const completedBookings = allWorkerBookings.filter(b => b.status === 'Completed').length;
      const totalEarnings = allWorkerBookings
        .filter(b => b.status === 'Completed')
        .reduce((sum, b) => sum + (b.amount || 0), 0);
      
      // Update worker stats
      worker.stats = {
        totalBookings: allWorkerBookings.length,
        completedBookings,
        totalEarnings,
        earnings: worker.stats?.earnings || []
      };
      
      // Add today's earnings
      const today = new Date().toISOString().split('T')[0];
      const existingEarningIndex = worker.stats.earnings.findIndex(e => e.date === today);
      if (existingEarningIndex >= 0) {
        worker.stats.earnings[existingEarningIndex].amount += booking.amount || 0;
      } else {
        worker.stats.earnings.push({
          date: today,
          amount: booking.amount || 0
        });
      }
      
      await worker.save();
    }
    // Notify customer
    await Notification.create({
      type: 'booking_completed',
      user: booking.customer,
      userModel: 'Customer',
      booking: booking._id,
      message: `Your booking for ${booking.serviceTitle} has been marked as completed.`
    });

    // Notify admin
    const Admin = await import('../models/Admin.js').then(mod => mod.default);
    const admins = await Admin.find();
    await Promise.all(admins.map(admin => 
      Notification.create({
        type: 'booking_completed',
        user: admin._id,
        userModel: 'Admin',
        booking: booking._id,
        message: `Booking completed for ${booking.serviceTitle}`
      })
    ));
    res.json({ message: 'Booking marked as completed', booking });
  } catch (err) {
    res.status(500).json({ message: 'Failed to verify OTP', error: err.message });
  }
});

export default router;
