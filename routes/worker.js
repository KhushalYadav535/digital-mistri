import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Worker from '../models/Worker.js';
import Booking from '../models/Booking.js';
import { workerAuth } from '../middleware/auth.js';
import Notification from '../models/Notification.js';
import { sendPushNotification, sendRealTimeNotification } from '../utils/notifications.js';

const router = express.Router();

// Worker Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  console.log('Worker login request:', req.body);
  try {
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    const worker = await Worker.findOne({ email });
    if (!worker) {
      console.log('Worker not found:', email);
      return res.status(404).json({ message: 'Worker not found' });
    }
    // Password is the worker's phone (hashed in DB)
    const isMatch = await bcrypt.compare(password, worker.password);
    if (!isMatch) {
      console.log('Invalid credentials for worker:', email);
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: worker._id, role: 'worker' }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    // Update last login
    worker.lastLogin = new Date();
    await worker.save();
    
    res.json({ 
      token, 
      worker: { 
        id: worker._id, 
        name: worker.name, 
        email: worker.email, 
        phone: worker.phone,
        isVerified: worker.isVerified,
        isAvailable: worker.isAvailable,
        services: worker.services || []
      } 
    });
  } catch (err) {
    console.error('Worker login error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/worker/profile (allow with or without trailing slash)
router.get(['/profile', '/profile/'], workerAuth, async (req, res) => {
  console.log('GET /api/worker/profile called', req.headers);
  try {
    const worker = await Worker.findById(req.user.id);
    if (!worker) return res.status(404).json({ message: 'Worker not found' });
    
    // Calculate stats from bookings
    const allWorkerBookings = await Booking.find({ worker: worker._id });
    const totalBookings = allWorkerBookings.length;
    const completedBookings = allWorkerBookings.filter(booking => 
      booking.status === 'Completed'
    ).length;
    const totalEarnings = allWorkerBookings
      .filter(booking => booking.status === 'Completed')
      .reduce((sum, booking) => sum + (booking.amount || 0), 0);
    
    res.json({
      id: worker._id,
      name: worker.name,
      email: worker.email,
      phone: worker.phone,
      services: worker.services || [],
      totalBookings,
      completedBookings,
      totalEarnings,
      isVerified: worker.isVerified,
      isAvailable: worker.isAvailable
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /api/worker/profile - Update worker profile
router.put('/profile', workerAuth, async (req, res) => {
  try {
    const { name, phone, services } = req.body;
    const updateData = {};
    
    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;
    if (services) updateData.services = services;
    
    const worker = await Worker.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true }
    );
    
    if (!worker) return res.status(404).json({ message: 'Worker not found' });
    
    // Send real-time notification for profile update
    sendRealTimeNotification(worker._id, {
      type: 'profile_updated',
      message: 'Profile updated successfully',
      data: { worker: worker._id }
    });
    
    res.json({
      message: 'Profile updated successfully',
      worker: {
        id: worker._id,
        name: worker.name,
        email: worker.email,
        phone: worker.phone,
        services: worker.services || [],
        isVerified: worker.isVerified,
        isAvailable: worker.isAvailable
      }
    });
  } catch (err) {
    console.error('Failed to update profile:', err);
    res.status(500).json({ message: 'Failed to update profile', error: err.message });
  }
});

// GET /api/worker/dashboard
router.get('/dashboard', workerAuth, async (req, res) => {
  console.log('GET /api/worker/dashboard called', req.headers);
  try {
    const worker = await Worker.findById(req.user.id);
    if (!worker) {
      console.log('Worker not found for dashboard:', req.user.id);
      return res.status(404).json({ message: 'Worker not found' });
    }
    
    // Fetch assigned bookings for this worker
    const assignedBookings = await Booking.find({
      worker: worker._id,
      status: { $in: ['Worker Assigned', 'Accepted', 'In Progress'] }
    }).populate('customer', 'name phone');
    
    // Fetch completed bookings for this worker
    const completedBookingsList = await Booking.find({
      worker: worker._id,
      status: 'Completed'
    }).populate('customer', 'name phone').sort({ updatedAt: -1 }).limit(10);
    
    console.log('Completed bookings found:', completedBookingsList.length);
    console.log('Completed bookings data:', completedBookingsList);
    
    // Calculate statistics dynamically from bookings
    const allWorkerBookings = await Booking.find({ worker: worker._id });
    const totalBookings = allWorkerBookings.length;
    const completedBookings = allWorkerBookings.filter(booking => 
      booking.status === 'Completed'
    ).length;
    
    // Calculate total earnings from completed bookings
    const totalEarnings = allWorkerBookings
      .filter(booking => booking.status === 'Completed')
      .reduce((sum, booking) => sum + (booking.amount || 0), 0);
    
    // Generate earnings array for the last 30 days
    const earnings = [];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const completedBookingsInRange = allWorkerBookings.filter(booking => 
      booking.status === 'Completed' && 
      new Date(booking.updatedAt) >= thirtyDaysAgo
    );
    
    // Group earnings by date
    const earningsByDate = {};
    completedBookingsInRange.forEach(booking => {
      const date = new Date(booking.updatedAt).toISOString().split('T')[0];
      earningsByDate[date] = (earningsByDate[date] || 0) + (booking.amount || 0);
    });
    
    // Convert to earnings array format
    Object.keys(earningsByDate).forEach(date => {
      earnings.push({
        date: date,
        amount: earningsByDate[date]
      });
    });
    
    console.log('Calculated stats for worker:', {
      totalBookings,
      completedBookings,
      totalEarnings,
      earningsCount: earnings.length
    });
    
    res.json({
      id: worker._id,
      name: worker.name,
      email: worker.email,
      phone: worker.phone,
      services: worker.services || [],
      stats: {
        totalBookings,
        completedBookings,
        totalEarnings,
        earnings
      },
      isVerified: worker.isVerified,
      isAvailable: worker.isAvailable,
      assignedBookings,
      completedBookings: completedBookingsList
    });
  } catch (err) {
    console.error('Error in worker dashboard:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Update worker availability
router.put('/availability', workerAuth, async (req, res) => {
  try {
    const { isAvailable } = req.body;
    const worker = await Worker.findByIdAndUpdate(
      req.user.id,
      { isAvailable },
      { new: true }
    );
    if (!worker) return res.status(404).json({ message: 'Worker not found' });
    
    // Send real-time notification for availability change
    sendRealTimeNotification(worker._id, {
      type: 'availability_updated',
      message: `Availability updated to ${isAvailable ? 'Available' : 'Unavailable'}`,
      data: { isAvailable: worker.isAvailable }
    });
    
    res.json({ message: 'Availability updated', isAvailable: worker.isAvailable });
  } catch (err) {
    console.error('Failed to update availability:', err);
    res.status(500).json({ message: 'Failed to update availability', error: err.message });
  }
});

// GET /api/worker/bookings - Get assigned bookings (standardized endpoint)
router.get('/bookings', workerAuth, async (req, res) => {
  console.log('GET /api/worker/bookings called', req.headers);
  try {
    const worker = await Worker.findById(req.user.id);
    if (!worker) {
      console.log('Worker not found for bookings:', req.user.id);
      return res.status(404).json({ message: 'Worker not found' });
    }
    // Fetch assigned bookings for this worker
    const bookings = await Booking.find({
      worker: worker._id,
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

// GET /api/worker/bookings/:id - Get specific booking details (standardized endpoint)
router.get('/bookings/:id', workerAuth, async (req, res) => {
  try {
    const workerId = req.user.id;
    const bookingId = req.params.id;
    const booking = await Booking.findOne({ _id: bookingId, worker: workerId })
      .populate('customer', 'name phone')
      .populate('worker', 'name phone');
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found or not assigned to you' });
    }
    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch booking details', error: err.message });
  }
});

// GET /api/worker/unassigned-bookings - Get available bookings (standardized endpoint)
router.get('/unassigned-bookings', workerAuth, async (req, res) => {
  console.log('GET /api/worker/unassigned-bookings called', req.headers);
  try {
    const worker = await Worker.findById(req.user.id);
    if (!worker) {
      console.log('Worker not found for unassigned bookings:', req.user.id);
      return res.status(404).json({ message: 'Worker not found' });
    }
    if (!worker.services || worker.services.length === 0) {
      console.log('Worker has no services:', worker._id);
      return res.json([]); // No services, no bookings
    }
    // Find all pending bookings matching any of the worker's services
    const bookings = await Booking.find({
      status: 'Pending',
      serviceType: { $in: worker.services }
    })
    .populate('customer', 'name phone')
    .sort({ createdAt: -1 });
    console.log('Unassigned bookings for worker:', bookings);
    res.json(bookings);
  } catch (err) {
    console.error('Error in unassigned bookings:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/worker/unassigned-bookings/:id - Get specific unassigned booking details (standardized endpoint)
router.get('/unassigned-bookings/:id', workerAuth, async (req, res) => {
  try {
    const worker = await Worker.findById(req.user.id);
    if (!worker) return res.status(404).json({ message: 'Worker not found' });

    const booking = await Booking.findById(req.params.id)
      .populate('customer', 'name') // Only show customer name, not phone
      .populate('worker', 'name phone');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    // Only allow if booking is pending and worker is eligible
    if (
      booking.status !== 'Pending' ||
      !worker.services.includes(booking.serviceType)
    ) {
      return res.status(403).json({ message: 'Not authorized to view this booking' });
    }

    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch booking details', error: err.message });
  }
});

// PUT /api/worker/bookings/:id/accept - Accept booking (standardized endpoint)
router.put('/bookings/:id/accept', workerAuth, async (req, res) => {
  console.log('PUT /api/worker/bookings/:id/accept called', req.headers, req.params.id);
  try {
    const worker = await Worker.findById(req.user.id);
    if (!worker) {
      console.log('Worker not found for accept booking:', req.user.id);
      return res.status(404).json({ message: 'Worker not found' });
    }
    // Find the booking and ensure it's still pending
    const booking = await Booking.findOne({
      _id: req.params.id,
      status: 'Pending',
      worker: { $exists: false }
    });
    if (!booking) {
      console.log('Booking not found or already assigned:', req.params.id);
      return res.status(404).json({ message: 'Booking not found or already assigned' });
    }
    // Assign the booking to this worker
    booking.worker = worker._id;
    booking.status = 'Worker Assigned';
    booking.assignedAt = new Date();
    await booking.save();
    console.log('Booking accepted by worker:', booking);
    
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
    
    // Send real-time notification to customer
    sendRealTimeNotification(booking.customer, {
      type: 'worker_assigned',
      message: `A worker has been assigned to your booking for ${booking.serviceTitle}`,
      data: { bookingId: booking._id.toString() }
    });
    
    // Send real-time notification to worker
    sendRealTimeNotification(worker._id, {
      type: 'booking_accepted',
      message: 'Booking accepted successfully',
      data: { bookingId: booking._id.toString() }
    });
    
    res.json({ message: 'Booking accepted', booking });
  } catch (err) {
    console.error('Error in accept booking:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /api/worker/bookings/:id/reject - Reject booking (standardized endpoint)
router.put('/bookings/:id/reject', workerAuth, async (req, res) => {
  try {
    const worker = await Worker.findById(req.user.id);
    if (!worker) {
      return res.status(404).json({ message: 'Worker not found' });
    }
    
    const booking = await Booking.findOne({
      _id: req.params.id,
      worker: worker._id,
      status: 'Worker Assigned'
    });
    
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found or not assigned to you' });
    }
    
    // Unassign worker and set status to Pending so other workers can accept
    booking.status = 'Pending';
    booking.worker = null;
    booking.assignedAt = null;
    await booking.save();
    
    // Create notification for customer
    await Notification.create({
      type: 'booking_rejected',
      user: booking.customer,
      userModel: 'Customer',
      title: 'Booking Rejected',
      message: `Your booking for ${booking.serviceTitle} has been rejected by the worker`,
      data: { bookingId: booking._id.toString() },
      read: false
    });
    
    // Send real-time notification to customer
    sendRealTimeNotification(booking.customer, {
      type: 'booking_rejected',
      message: `Your booking for ${booking.serviceTitle} has been rejected`,
      data: { bookingId: booking._id.toString() }
    });
    
    // Send real-time notification to worker
    sendRealTimeNotification(worker._id, {
      type: 'booking_rejected',
      message: 'Booking rejected successfully',
      data: { bookingId: booking._id.toString() }
    });
    
    res.json({ message: 'Booking rejected successfully' });
  } catch (err) {
    console.error('Error rejecting booking:', err);
    res.status(500).json({ message: 'Failed to reject booking', error: err.message });
  }
});

// POST /api/worker/jobs/:id/start - Start a job (standardized endpoint)
router.post('/jobs/:id/start', workerAuth, async (req, res) => {
  try {
    const workerId = req.user.id;
    const bookingId = req.params.id;
    
    const booking = await Booking.findOne({ 
      _id: bookingId, 
      worker: workerId,
      status: { $in: ['Worker Assigned', 'Accepted'] }
    });
    
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found or not assigned to you' });
    }
    
    booking.status = 'In Progress';
    booking.startedAt = new Date();
    await booking.save();
    
    // Create notification for customer
    await Notification.create({
      type: 'job_started',
      user: booking.customer,
      userModel: 'Customer',
      title: 'Job Started',
      message: `Your service for ${booking.serviceTitle} has started`,
      data: { bookingId: booking._id.toString() },
      read: false
    });
    
    // Send real-time notification to customer
    sendRealTimeNotification(booking.customer, {
      type: 'job_started',
      message: `Your service for ${booking.serviceTitle} has started`,
      data: { bookingId: booking._id.toString() }
    });
    
    // Send real-time notification to worker
    sendRealTimeNotification(workerId, {
      type: 'job_started',
      message: 'Job started successfully',
      data: { bookingId: booking._id.toString() }
    });
    
    res.json({ message: 'Job started successfully', booking });
  } catch (err) {
    console.error('Error starting job:', err);
    res.status(500).json({ message: 'Failed to start job', error: err.message });
  }
});

// POST /api/worker/jobs/:id/complete - Complete a job (standardized endpoint)
router.post('/jobs/:id/complete', workerAuth, async (req, res) => {
  try {
    const workerId = req.user.id;
    const bookingId = req.params.id;
    
    const booking = await Booking.findOne({ 
      _id: bookingId, 
      worker: workerId,
      status: 'In Progress'
    });
    
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found or not in progress' });
    }
    
    booking.status = 'Completed';
    booking.completedAt = new Date();
    await booking.save();
    
    // Update worker stats
    await Worker.findByIdAndUpdate(workerId, {
      $inc: {
        'stats.totalBookings': 1,
        'stats.completedBookings': 1,
        'stats.totalEarnings': booking.amount || 0
      }
    });
    
    // Create notification for customer
    await Notification.create({
      type: 'job_completed',
      user: booking.customer,
      userModel: 'Customer',
      title: 'Job Completed',
      message: `Your service for ${booking.serviceTitle} has been completed`,
      data: { bookingId: booking._id.toString() },
      read: false
    });
    
    // Send real-time notification to customer
    sendRealTimeNotification(booking.customer, {
      type: 'job_completed',
      message: `Your service for ${booking.serviceTitle} has been completed`,
      data: { bookingId: booking._id.toString() }
    });
    
    // Send real-time notification to worker
    sendRealTimeNotification(workerId, {
      type: 'job_completed',
      message: 'Job completed successfully',
      data: { bookingId: booking._id.toString() }
    });
    
    res.json({ message: 'Job completed successfully', booking });
  } catch (err) {
    console.error('Error completing job:', err);
    res.status(500).json({ message: 'Failed to complete job', error: err.message });
  }
});

// POST /api/worker/jobs/:id/cancel - Cancel a job (standardized endpoint)
router.post('/jobs/:id/cancel', workerAuth, async (req, res) => {
  try {
    const workerId = req.user.id;
    const bookingId = req.params.id;
    
    const booking = await Booking.findOne({ 
      _id: bookingId, 
      worker: workerId,
      status: { $in: ['Worker Assigned', 'Accepted', 'In Progress'] }
    });
    
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found or not assigned to you' });
    }
    
    booking.status = 'Cancelled';
    booking.cancelledAt = new Date();
    booking.worker = null; // Remove worker assignment
    await booking.save();
    
    // Create notification for customer
    await Notification.create({
      type: 'job_cancelled',
      user: booking.customer,
      userModel: 'Customer',
      title: 'Job Cancelled',
      message: `Your service for ${booking.serviceTitle} has been cancelled by the worker`,
      data: { bookingId: booking._id.toString() },
      read: false
    });
    
    // Send real-time notification to customer
    sendRealTimeNotification(booking.customer, {
      type: 'job_cancelled',
      message: `Your service for ${booking.serviceTitle} has been cancelled`,
      data: { bookingId: booking._id.toString() }
    });
    
    // Send real-time notification to worker
    sendRealTimeNotification(workerId, {
      type: 'job_cancelled',
      message: 'Job cancelled successfully',
      data: { bookingId: booking._id.toString() }
    });
    
    res.json({ message: 'Job cancelled successfully', booking });
  } catch (err) {
    console.error('Error cancelling job:', err);
    res.status(500).json({ message: 'Failed to cancel job', error: err.message });
  }
});

// GET /api/worker/completed-bookings - Get completed bookings for debugging
router.get('/completed-bookings', workerAuth, async (req, res) => {
  try {
    const worker = await Worker.findById(req.user.id);
    if (!worker) {
      return res.status(404).json({ message: 'Worker not found' });
    }
    
    const completedBookings = await Booking.find({
      worker: worker._id,
      status: 'Completed'
    }).populate('customer', 'name phone');
    
    console.log('Debug - Completed bookings count:', completedBookings.length);
    console.log('Debug - Completed bookings:', completedBookings);
    
    res.json({
      count: completedBookings.length,
      bookings: completedBookings
    });
  } catch (err) {
    console.error('Error fetching completed bookings:', err);
    res.status(500).json({ message: 'Failed to fetch completed bookings', error: err.message });
  }
});

// GET /api/worker/earnings - Get detailed earnings data
router.get('/earnings', workerAuth, async (req, res) => {
  try {
    const worker = await Worker.findById(req.user.id);
    if (!worker) {
      return res.status(404).json({ message: 'Worker not found' });
    }
    
    const allWorkerBookings = await Booking.find({ worker: worker._id });
    const completedBookings = allWorkerBookings.filter(booking => 
      booking.status === 'Completed'
    );
    
    // Calculate earnings by period
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const dailyEarnings = completedBookings
      .filter(booking => new Date(booking.completedAt || booking.updatedAt) >= startOfDay)
      .reduce((sum, booking) => sum + (booking.amount || 0), 0);
    
    const weeklyEarnings = completedBookings
      .filter(booking => new Date(booking.completedAt || booking.updatedAt) >= startOfWeek)
      .reduce((sum, booking) => sum + (booking.amount || 0), 0);
    
    const monthlyEarnings = completedBookings
      .filter(booking => new Date(booking.completedAt || booking.updatedAt) >= startOfMonth)
      .reduce((sum, booking) => sum + (booking.amount || 0), 0);
    
    const totalEarnings = completedBookings
      .reduce((sum, booking) => sum + (booking.amount || 0), 0);
    
    res.json({
      daily: dailyEarnings,
      weekly: weeklyEarnings,
      monthly: monthlyEarnings,
      total: totalEarnings,
      completedJobs: completedBookings.length
    });
  } catch (err) {
    console.error('Error fetching earnings:', err);
    res.status(500).json({ message: 'Failed to fetch earnings', error: err.message });
  }
});

export default router;

