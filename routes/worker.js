import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Worker from '../models/Worker.js';
import Booking from '../models/Booking.js';
import { workerAuth } from '../middleware/auth.js';

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
    res.json({ token, worker: { id: worker._id, name: worker.name, email: worker.email, phone: worker.phone } });
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
    res.json({
      id: worker._id,
      name: worker.name,
      email: worker.email,
      phone: worker.phone,
      services: worker.services || [],
      totalBookings: worker.stats?.totalBookings || 0,
      completedBookings: worker.stats?.completedBookings || 0,
      totalEarnings: worker.stats?.totalEarnings || 0,
      isVerified: worker.isVerified,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
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
    });
    console.log('Assigned bookings for worker:', assignedBookings);
    res.json({
      id: worker._id,
      name: worker.name,
      email: worker.email,
      phone: worker.phone,
      services: worker.services || [],
      stats: {
        ...worker.stats,
        earnings: worker.stats.earnings || []
      },
      isVerified: worker.isVerified,
      assignedBookings
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
    res.json({ message: 'Availability updated', isAvailable: worker.isAvailable });
  } catch (err) {
    console.error('Failed to update availability:', err);
    res.status(500).json({ message: 'Failed to update availability', error: err.message });
  }
});

// GET /api/worker/bookings/:id - fetch details for a specific booking assigned to this worker
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

// GET /api/worker/unassigned-bookings
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

// GET /api/worker/unassigned-bookings/:id - get details for a pending booking if worker is eligible
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

// PUT /api/worker/accept-booking/:bookingId
router.put('/accept-booking/:bookingId', workerAuth, async (req, res) => {
  console.log('PUT /api/worker/accept-booking called', req.headers, req.params.bookingId);
  try {
    const worker = await Worker.findById(req.user.id);
    if (!worker) {
      console.log('Worker not found for accept booking:', req.user.id);
      return res.status(404).json({ message: 'Worker not found' });
    }
    // Find the booking and ensure it's still pending
    const booking = await Booking.findOne({
      _id: req.params.bookingId,
      status: 'Pending',
      worker: { $exists: false }
    });
    if (!booking) {
      console.log('Booking not found or already assigned:', req.params.bookingId);
      return res.status(404).json({ message: 'Booking not found or already assigned' });
    }
    // Assign the booking to this worker
    booking.worker = worker._id;
    booking.status = 'Worker Assigned';
    await booking.save();
    console.log('Booking accepted by worker:', booking);
    res.json({ message: 'Booking accepted', booking });
  } catch (err) {
    console.error('Error in accept booking:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/worker/bookings
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

export default router;

