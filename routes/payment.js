import express from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import Booking from '../models/Booking.js';
import dotenv from 'dotenv';
import { customerAuth } from '../middleware/auth.js';
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

// Create booking after successful payment
router.post('/create-booking-after-payment', customerAuth, async (req, res) => {
  try {
    const { orderId, paymentId, bookingData, isMultipleService } = req.body;
    
    console.log('💰 Creating booking after successful payment:', { orderId, paymentId, isMultipleService });
    
    if (!bookingData) {
      return res.status(400).json({ message: 'Booking data is required' });
    }

    // Import required modules
    const Booking = (await import('../models/Booking.js')).default;
    const Worker = (await import('../models/Worker.js')).default;
    const Notification = (await import('../models/Notification.js')).default;
    const Job = (await import('../models/Job.js')).default;
    const { calculateCommissionAndPayment } = await import('../utils/commissionCalculator.js');
    const { calculateDistanceFromJanghaiBazar } = await import('../utils/distanceCalculator.js');
    const { sendRealTimeNotification } = await import('../utils/notifications.js');

    let bookingResponse;
    
    if (isMultipleService) {
      // Create multiple services booking directly
      console.log('Creating multiple services booking after payment...');
      
      const { services, bookingDate, bookingTime, address, phone, gpsCoordinates } = bookingData;
      const customerId = req.user.id; // Get from auth middleware

      // Calculate distance and charges
      const distanceInfo = await calculateDistanceFromJanghaiBazar(address);
      
      // Calculate commission for all services
      const commissionData = {
        totalServiceAmount: 0,
        totalAdminCommission: 0,
        totalWorkerPayment: 0,
        totalAmount: 0
      };

      services.forEach(service => {
        const serviceAmount = service.amount * (service.quantity || 1);
        const { adminCommission, workerPayment } = calculateCommissionAndPayment(serviceAmount, 0);
        commissionData.totalServiceAmount += serviceAmount;
        commissionData.totalAdminCommission += adminCommission;
        commissionData.totalWorkerPayment += workerPayment;
      });

      commissionData.totalAmount = commissionData.totalServiceAmount + distanceInfo.distanceCharge;

      // Create parent booking
      const parentBookingData = {
        customer: customerId,
        serviceType: 'Multiple',
        serviceTitle: `Multiple Services (${services.length} items)`,
        bookingDate: new Date(bookingDate),
        bookingTime,
        address,
        phone,
        amount: commissionData.totalServiceAmount,
        adminCommission: commissionData.totalAdminCommission,
        workerPayment: commissionData.totalWorkerPayment,
        distance: distanceInfo.distance,
        distanceCharge: distanceInfo.distanceCharge,
        totalAmount: commissionData.totalAmount,
        customerCoordinates: distanceInfo.customerCoordinates,
        status: 'Pending',
        isMultipleServiceBooking: true,
        serviceBreakdown: services.map(service => ({
          serviceType: service.serviceType,
          serviceTitle: service.serviceTitle,
          amount: service.amount,
          quantity: service.quantity || 1
        })),
        paymentVerified: true,
        paidAmount: commissionData.totalAmount,
        paymentVerifiedAt: new Date()
      };

      const parentBooking = await Booking.create(parentBookingData);
      console.log('Parent booking created successfully:', parentBooking._id);

      // Create child bookings
      const childBookings = [];
      for (const service of services) {
        const serviceAmount = service.amount * (service.quantity || 1);
        const serviceDistanceCharge = distanceInfo.distanceCharge / services.length;
        const { adminCommission, workerPayment } = calculateCommissionAndPayment(serviceAmount, serviceDistanceCharge);
        const serviceTotalAmount = serviceAmount + serviceDistanceCharge;

        const childBookingData = {
          customer: customerId,
          serviceType: service.serviceType,
          serviceTitle: service.serviceTitle,
          bookingDate: new Date(bookingDate),
          bookingTime,
          address,
          phone,
          amount: serviceAmount,
          adminCommission,
          workerPayment,
          distance: distanceInfo.distance,
          distanceCharge: serviceDistanceCharge,
          totalAmount: serviceTotalAmount,
          customerCoordinates: distanceInfo.customerCoordinates,
          status: 'Pending',
          parentBooking: parentBooking._id,
          isMultipleServiceBooking: false,
          paymentVerified: true,
          paidAmount: serviceTotalAmount,
          paymentVerifiedAt: new Date()
        };

        const childBooking = await Booking.create(childBookingData);
        childBookings.push(childBooking._id);

        // Find and notify workers
        const availableWorkers = await Worker.find({
          services: service.serviceType,
          isVerified: true,
          isAvailable: true
        });

        for (const worker of availableWorkers) {
          await Notification.create({
            type: 'new_booking_available',
            user: worker._id,
            userModel: 'Worker',
            title: 'New Booking Available',
            message: `A new booking is available for ${service.serviceTitle}`,
            data: { 
              bookingId: childBooking._id.toString(),
              parentBookingId: parentBooking._id.toString(),
              isMultipleService: true
            },
            read: false
          });

          sendRealTimeNotification(worker._id, {
            type: 'new_booking_available',
            message: `New booking available for service: ${service.serviceTitle}`,
            bookingId: childBooking._id.toString()
          });
        }

        // Create job entry
        await Job.create({
          service: service.serviceType,
          customer: customerId,
          candidateWorkers: availableWorkers.map(w => w._id),
          details: {
            amount: serviceAmount,
            totalAmount: serviceTotalAmount,
            distance: distanceInfo.distance,
            distanceCharge: serviceDistanceCharge,
            date: bookingDate,
            time: bookingTime,
            address,
            phone,
            serviceTitle: service.serviceTitle
          },
          status: 'Pending',
          booking: childBooking._id
        });
      }

      // Update parent booking with child bookings
      await Booking.findByIdAndUpdate(parentBooking._id, {
        childBookings: childBookings
      });

      bookingResponse = {
        parentBooking: parentBooking,
        childBookings: childBookings
      };
      console.log('Multiple services booking created after payment:', bookingResponse);
    } else {
      // Create single service booking directly
      console.log('Creating single service booking after payment...');
      
      const { serviceId, serviceTitle, date, time, address, phone, amount, gpsCoordinates } = bookingData;
      const customerId = req.user.id;

      // Calculate distance and charges
      const distanceInfo = await calculateDistanceFromJanghaiBazar(address);
      
      // Calculate commission and payment
      const { adminCommission, workerPayment } = calculateCommissionAndPayment(amount, distanceInfo.distanceCharge);
      const totalAmount = amount + distanceInfo.distanceCharge;

      // Create booking
      const bookingDataToSave = {
        customer: customerId,
        serviceType: serviceId,
        serviceTitle,
        bookingDate: new Date(date),
        bookingTime: time,
        address,
        phone,
        amount,
        adminCommission,
        workerPayment,
        distance: distanceInfo.distance,
        distanceCharge: distanceInfo.distanceCharge,
        totalAmount,
        customerCoordinates: distanceInfo.customerCoordinates,
        status: 'Pending',
        paymentVerified: true,
        paidAmount: totalAmount,
        paymentVerifiedAt: new Date()
      };

      const booking = await Booking.create(bookingDataToSave);
      console.log('Single service booking created after payment:', booking._id);

      // Find available workers
      const availableWorkers = await Worker.find({
        services: serviceId,
        isVerified: true,
        isAvailable: true
      });

      // Notify workers
      await Promise.all(availableWorkers.map(async worker => {
        await Notification.create({
          type: 'new_booking_available',
          user: worker._id,
          userModel: 'Worker',
          title: 'New Booking Available',
          message: `A new booking is available for ${serviceTitle}`,
          data: { bookingId: booking._id.toString() },
          read: false
        });

        sendRealTimeNotification(worker._id, {
          type: 'new_booking_available',
          message: `New booking available for service: ${serviceTitle}`,
          bookingId: booking._id.toString()
        });
      }));

      // Create job entry
      await Job.create({
        service: serviceId,
        customer: customerId,
        candidateWorkers: availableWorkers.map(w => w._id),
        details: {
          amount,
          totalAmount,
          distance: distanceInfo.distance,
          distanceCharge: distanceInfo.distanceCharge,
          date,
          time,
          address,
          phone,
          serviceTitle
        },
        status: 'Pending',
        booking: booking._id
      });

      bookingResponse = booking;
      console.log('Single service booking created after payment:', bookingResponse);
    }

    res.json({
      success: true,
      booking: bookingResponse,
      message: 'Booking created successfully after payment'
    });
  } catch (err) {
    console.error('Error creating booking after payment:', err);
    res.status(500).json({ 
      message: 'Failed to create booking after payment',
      error: err.message 
    });
  }
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