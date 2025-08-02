import express from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import Booking from '../models/Booking.js';
import dotenv from 'dotenv';
dotenv.config();

const router = express.Router();

// Check if Razorpay keys are configured
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
  console.warn('⚠️  Razorpay keys not configured. Payment functionality will be limited.');
  console.warn('Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables.');
}

const razorpay = RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET 
  ? new Razorpay({
      key_id: RAZORPAY_KEY_ID,
      key_secret: RAZORPAY_KEY_SECRET,
    })
  : null;

// Create Razorpay order
router.post('/create-order', async (req, res) => {
  try {
    const { amount, currency = 'INR', receipt, notes, bookingId } = req.body;
    
    console.log('💰 Payment order request:', { amount, currency, bookingId });
    
    if (!amount) {
      return res.status(400).json({ message: 'Amount is required' });
    }

    // Check if Razorpay is configured
    if (!razorpay) {
      console.error('Razorpay not configured - missing API keys');
      return res.status(500).json({ 
        message: 'Payment service not configured. Please contact support.',
        error: 'RAZORPAY_NOT_CONFIGURED'
      });
    }

    console.log('🔑 Razorpay configuration check:', {
      hasKeyId: !!RAZORPAY_KEY_ID,
      hasKeySecret: !!RAZORPAY_KEY_SECRET,
      keyIdPrefix: RAZORPAY_KEY_ID ? RAZORPAY_KEY_ID.substring(0, 10) + '...' : 'missing'
    });

    const options = {
      amount: Math.round(amount), // Amount should already be in paise from frontend
      currency,
      receipt: receipt || `rcpt_${Date.now()}`,
      notes: {
        ...notes,
        bookingId: bookingId || 'unknown'
      },
    };

    console.log('Creating Razorpay order with options:', {
      ...options,
      key_id: RAZORPAY_KEY_ID ? '***configured***' : '***missing***'
    });

    try {
      const order = await razorpay.orders.create(options);
      console.log('Razorpay order created successfully:', order.id);
      return res.json({ order });
    } catch (razorpayError) {
      console.error('Razorpay API error:', razorpayError);
      
      // If Razorpay fails, create a mock order for testing
      if (razorpayError.statusCode === 401 || razorpayError.statusCode === 400) {
        console.log('🔄 Creating mock order for testing...');
        const mockOrder = {
          id: `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          entity: 'order',
          amount: Math.round(amount),
          amount_paid: 0,
          amount_due: Math.round(amount),
          currency: currency,
          receipt: receipt || `rcpt_${Date.now()}`,
          status: 'created',
          attempts: 0,
          notes: {
            ...notes,
            bookingId: bookingId || 'unknown',
            isMockOrder: true
          },
          created_at: Date.now()
        };
        
        console.log('✅ Mock order created:', mockOrder.id);
        return res.json({ 
          order: mockOrder,
          isMockOrder: true,
          message: 'Mock order created for testing (Razorpay keys invalid)'
        });
      }
      
      throw razorpayError;
    }
  } catch (err) {
    console.error('Razorpay order creation error:', err);
    console.error('Error details:', {
      statusCode: err.statusCode,
      error: err.error,
      message: err.message
    });
    
    // Provide more specific error messages
    if (err.statusCode === 401) {
      return res.status(500).json({ 
        message: 'Payment service authentication failed. Please check Razorpay configuration.',
        error: 'RAZORPAY_AUTH_ERROR',
        details: err.error?.description || err.message
      });
    }
    
    if (err.statusCode === 400) {
      return res.status(400).json({ 
        message: 'Invalid payment request. Please check the amount and currency.',
        error: 'RAZORPAY_BAD_REQUEST',
        details: err.error?.description || err.message
      });
    }
    
    return res.status(500).json({ 
      message: 'Failed to create payment order. Please try again.',
      error: 'RAZORPAY_ERROR',
      details: err.message 
    });
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
  res.json({ 
    message: 'Payment route is working!',
    razorpayConfigured: !!razorpay,
    hasKeyId: !!RAZORPAY_KEY_ID,
    hasKeySecret: !!RAZORPAY_KEY_SECRET
  });
});

export default router; 