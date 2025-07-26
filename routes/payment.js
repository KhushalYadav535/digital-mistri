import express from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import Booking from '../models/Booking.js';
import dotenv from 'dotenv';
dotenv.config();

const router = express.Router();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Create Razorpay order
router.post('/create-order', async (req, res) => {
  try {
    const { amount, currency = 'INR', receipt, notes } = req.body;
    if (!amount) return res.status(400).json({ message: 'Amount is required' });
    const options = {
      amount: Math.round(amount * 100), // Razorpay expects paise
      currency,
      receipt: receipt || `rcpt_${Date.now()}`,
      notes: notes || {},
    };
    const order = await razorpay.orders.create(options);
    return res.json({ order });
  } catch (err) {
    console.error('Razorpay order creation error:', err);
    return res.status(500).json({ message: 'Failed to create order', error: err.message });
  }
});

// Add GET handler for /create-order to return a helpful error
router.get('/create-order', (req, res) => {
  res.status(405).json({
    message: 'GET not allowed. Please use POST to /api/payment/create-order with JSON body { amount, currency }.'
  });
});

// Razorpay webhook for payment verification
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET; // Use env variable for webhook secret
  const signature = req.headers['x-razorpay-signature'];
  const body = req.body;
  let event;
  try {
    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(req.body)
      .digest('hex');
    if (signature !== expectedSignature) {
      return res.status(400).json({ message: 'Invalid signature' });
    }
    event = JSON.parse(req.body);
  } catch (err) {
    return res.status(400).json({ message: 'Webhook signature verification failed', error: err.message });
  }

  // Handle payment event
  if (event.event === 'payment.captured') {
    const payment = event.payload.payment.entity;
    // Find and update booking/payment in your DB
    // Example: await Booking.findOneAndUpdate({ razorpayOrderId: payment.order_id }, { paymentStatus: 'PAID', paymentId: payment.id });
    // ...
    console.log('Payment captured:', payment);
  }
  res.json({ status: 'ok' });
});

// Test route to confirm payment route is working
router.get('/test', (req, res) => {
  res.json({ message: 'Payment route is working!' });
});

export default router; 