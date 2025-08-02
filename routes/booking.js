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
import { calculateDistanceFromJanghaiBazar } from '../utils/distanceCalculator.js';

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

    // Calculate distance and distance charge from Janghai Bazar
    console.log('=== Distance Calculation Phase ===');
    let distanceInfo = {
      distance: 0,
      distanceCharge: 0,
      customerCoordinates: null,
      baseLocation: null
    };

    // Check if GPS coordinates are provided
    const { gpsCoordinates } = req.body;
    
    if (gpsCoordinates && gpsCoordinates.latitude && gpsCoordinates.longitude) {
      console.log('📍 GPS coordinates provided:', gpsCoordinates);
      
      // Use GPS coordinates for more accurate distance calculation
      const janghaiBazarCoords = {
        latitude: 25.541297129300112, // Janghai Bazar, Prayagraj (212401)
        longitude: 82.31064807968316
      };
      
      const { calculateDistance } = await import('../utils/distanceCalculator.js');
      const distance = calculateDistance(
        janghaiBazarCoords.latitude,
        janghaiBazarCoords.longitude,
        gpsCoordinates.latitude,
        gpsCoordinates.longitude
      );
      
      distanceInfo = {
        distance: distance,
        distanceCharge: Math.round(distance * 10), // ₹10 per km
        customerCoordinates: {
          latitude: gpsCoordinates.latitude,
          longitude: gpsCoordinates.longitude,
          displayName: gpsCoordinates.address || 'GPS Location',
          accuracy: gpsCoordinates.accuracy || 0.8
        },
        baseLocation: janghaiBazarCoords
      };
      
      console.log('📍 GPS-based distance calculation:', {
        distance: distance,
        distanceCharge: distanceInfo.distanceCharge,
        accuracy: gpsCoordinates.accuracy
      });
    } else {
      // Fallback to address-based geocoding
      try {
        distanceInfo = await calculateDistanceFromJanghaiBazar(address);
        console.log('Address-based distance calculation result:', distanceInfo);
        
        // Log location accuracy
        if (distanceInfo.customerCoordinates && distanceInfo.customerCoordinates.accuracy) {
          console.log(`Location accuracy: ${Math.round(distanceInfo.customerCoordinates.accuracy * 100)}%`);
          console.log(`Resolved address: ${distanceInfo.customerCoordinates.displayName}`);
        }
      } catch (distanceError) {
        console.warn('Distance calculation failed, using default values:', distanceError.message);
      }
    }

    // Calculate total amount including distance charge
    const totalAmount = finalAmount + distanceInfo.distanceCharge;
    console.log('Amount breakdown:', {
      serviceAmount: finalAmount,
      distanceCharge: distanceInfo.distanceCharge,
      totalAmount: totalAmount
    });

    // Create booking without assigning worker
    const bookingData = {
      customer: customerId,
      serviceType,
      serviceTitle,
      bookingDate: new Date(bookingDate),
      bookingTime,
      address,
      phone,
      amount: finalAmount, // Service amount
      distance: distanceInfo.distance,
      distanceCharge: distanceInfo.distanceCharge,
      totalAmount: totalAmount, // Total amount including distance charge
      customerCoordinates: distanceInfo.customerCoordinates,
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
        message: `Your booking for ${serviceTitle} has been created. Service charge: ₹${finalAmount}, Distance charge: ₹${distanceInfo.distanceCharge}, Total: ₹${totalAmount}`,
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
          totalAmount: totalAmount,
          distance: distanceInfo.distance,
          distanceCharge: distanceInfo.distanceCharge,
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
      return res.status(201).json({
        ...booking.toObject(),
        paymentLink: booking.cashfreePaymentLink,
        paymentSessionId: booking.cashfreePaymentSessionId,
        cashfreeOrderId: booking.cashfreeOrderId
      });
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

// Create multiple service bookings (customer)
router.post('/multiple-services', customerAuth, async (req, res) => {
  console.log('=== Multiple Services Booking Request Started ===');
  console.log('Request Headers:', req.headers);
  console.log('Request Body:', JSON.stringify(req.body, null, 2));
  
  try {
    const { 
      services, // Array of services with their details
      bookingDate, 
      bookingTime, 
      address,
      phone,
      gpsCoordinates
    } = req.body;
    const customerId = req.user.id;

    console.log('=== Validation Phase ===');
    console.log('Validating required fields...');
    if (!services || !Array.isArray(services) || services.length === 0) {
      console.error('Validation failed: No services provided');
      return res.status(400).json({ 
        message: 'At least one service is required',
        required: ['services']
      });
    }

    if (!address || !bookingDate || !bookingTime || !phone) {
      console.error('Validation failed:', { address, bookingDate, bookingTime, phone });
      return res.status(400).json({ 
        message: 'Missing required fields',
        required: ['address', 'bookingDate', 'bookingTime', 'phone']
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

    // Validate each service
    for (const service of services) {
      if (!service.serviceType || !service.serviceTitle || !service.amount) {
        console.error('Invalid service data:', service);
        return res.status(400).json({ 
          message: 'Each service must have serviceType, serviceTitle, and amount',
          invalidService: service
        });
      }
    }

    // Calculate distance and distance charge from Janghai Bazar
    console.log('=== Distance Calculation Phase ===');
    let distanceInfo = {
      distance: 0,
      distanceCharge: 0,
      customerCoordinates: null,
      baseLocation: null
    };

    if (gpsCoordinates && gpsCoordinates.latitude && gpsCoordinates.longitude) {
      console.log('📍 GPS coordinates provided:', gpsCoordinates);
      
      const janghaiBazarCoords = {
        latitude: 25.541297129300112,
        longitude: 82.31064807968316
      };
      
      const { calculateDistance } = await import('../utils/distanceCalculator.js');
      const distance = calculateDistance(
        janghaiBazarCoords.latitude,
        janghaiBazarCoords.longitude,
        gpsCoordinates.latitude,
        gpsCoordinates.longitude
      );
      
      distanceInfo = {
        distance: distance,
        distanceCharge: Math.round(distance * 10), // ₹10 per km
        customerCoordinates: {
          latitude: gpsCoordinates.latitude,
          longitude: gpsCoordinates.longitude,
          displayName: gpsCoordinates.address || 'GPS Location',
          accuracy: gpsCoordinates.accuracy || 0.8
        },
        baseLocation: janghaiBazarCoords
      };
    } else {
      try {
        distanceInfo = await calculateDistanceFromJanghaiBazar(address);
        console.log('Address-based distance calculation result:', distanceInfo);
      } catch (distanceError) {
        console.warn('Distance calculation failed, using default values:', distanceError.message);
      }
    }

    // Calculate total amount for all services
    const totalServiceAmount = services.reduce((sum, service) => sum + (service.amount * (service.quantity || 1)), 0);
    const totalAmount = totalServiceAmount + distanceInfo.distanceCharge;
    
    console.log('Amount breakdown:', {
      totalServiceAmount,
      distanceCharge: distanceInfo.distanceCharge,
      totalAmount: totalAmount
    });

    // Create parent booking for multiple services
    const parentBookingData = {
      customer: customerId,
      serviceType: 'Multiple',
      serviceTitle: `Multiple Services (${services.length} items)`,
      bookingDate: new Date(bookingDate),
      bookingTime,
      address,
      phone,
      amount: totalServiceAmount,
      distance: distanceInfo.distance,
      distanceCharge: distanceInfo.distanceCharge,
      totalAmount: totalAmount,
      customerCoordinates: distanceInfo.customerCoordinates,
      status: 'Pending',
      isMultipleServiceBooking: true,
      serviceBreakdown: services.map(service => ({
        serviceType: service.serviceType,
        serviceTitle: service.serviceTitle,
        amount: service.amount,
        quantity: service.quantity || 1
      }))
    };

    try {
      console.log('Creating parent booking...');
      const parentBooking = await Booking.create(parentBookingData);
      console.log('Parent booking created successfully:', parentBooking._id);

      const childBookings = [];
      const allWorkersNotified = new Set();

      // Create individual bookings for each service
      for (const service of services) {
        const serviceAmount = service.amount * (service.quantity || 1);
        const serviceTotalAmount = serviceAmount + (distanceInfo.distanceCharge / services.length); // Distribute distance charge

        const childBookingData = {
          customer: customerId,
          serviceType: service.serviceType,
          serviceTitle: service.serviceTitle,
          bookingDate: new Date(bookingDate),
          bookingTime,
          address,
          phone,
          amount: serviceAmount,
          distance: distanceInfo.distance,
          distanceCharge: distanceInfo.distanceCharge / services.length, // Distribute distance charge
          totalAmount: serviceTotalAmount,
          customerCoordinates: distanceInfo.customerCoordinates,
          status: 'Pending',
          parentBooking: parentBooking._id,
          isMultipleServiceBooking: false
        };

        const childBooking = await Booking.create(childBookingData);
        childBookings.push(childBooking._id);

        // Find available workers for this specific service
        const availableWorkers = await Worker.find({
          services: service.serviceType,
          isVerified: true,
          isAvailable: true
        });

        // Create notifications for workers (avoid duplicates)
        for (const worker of availableWorkers) {
          if (!allWorkersNotified.has(worker._id.toString())) {
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

            // Send push notification
            if (worker.fcmToken) {
              await sendPushNotification({
                token: worker.fcmToken,
                title: 'New Booking Available',
                body: `A new booking is available for ${service.serviceTitle}`,
                data: {
                  type: 'new_booking_available',
                  bookingId: childBooking._id.toString(),
                  parentBookingId: parentBooking._id.toString(),
                  isMultipleService: true
                }
              });
            }

            sendRealTimeNotification(worker._id, {
              type: 'new_booking_available',
              message: `New booking available for service: ${service.serviceTitle}`,
              bookingId: childBooking._id.toString(),
              parentBookingId: parentBooking._id.toString(),
              isMultipleService: true
            });

            allWorkersNotified.add(worker._id.toString());
          }
        }

        // Create corresponding job entry for this service
        const job = await Job.create({
          service: service.serviceType,
          customer: customerId,
          candidateWorkers: availableWorkers.map(w => w._id),
          details: {
            amount: serviceAmount,
            totalAmount: serviceTotalAmount,
            distance: distanceInfo.distance,
            distanceCharge: distanceInfo.distanceCharge / services.length,
            date: bookingDate,
            time: bookingTime,
            address,
            phone,
            serviceTitle: service.serviceTitle,
            parentBookingId: parentBooking._id.toString(),
            isMultipleService: true
          },
          status: 'Pending',
          booking: childBooking._id
        });

        console.log(`Job created for ${service.serviceTitle}:`, job._id);
      }

      // Update parent booking with child booking references
      parentBooking.childBookings = childBookings;
      await parentBooking.save();

      // Create notification for customer
      await Notification.create({
        type: 'booking_created',
        user: customerId,
        userModel: 'Customer',
        title: 'Multiple Services Booking Created Successfully',
        message: `Your booking for ${services.length} services has been created. Total amount: ₹${totalAmount}`,
        data: { 
          bookingId: parentBooking._id.toString(),
          childBookings: childBookings.map(id => id.toString())
        },
        read: false
      });

      // Create notification for admin
      const Admin = await import('../models/Admin.js').then(mod => mod.default);
      const admins = await Admin.find();
      await Promise.all(admins.map(admin => 
        Notification.create({
          type: 'new_booking_available',
          user: admin._id,
          userModel: 'Admin',
          title: 'Multiple Services Booking Created',
          message: `A new multiple services booking has been created with ${services.length} services`,
          data: { 
            bookingId: parentBooking._id.toString(),
            childBookings: childBookings.map(id => id.toString())
          },
          read: false
        })
      ));

      console.log('=== Multiple Services Booking Process Complete ===');
      return res.status(201).json({
        parentBooking: {
          ...parentBooking.toObject(),
          childBookings: childBookings
        },
        childBookings: childBookings,
        totalAmount: totalAmount,
        serviceBreakdown: services
      });

    } catch (createError) {
      console.error('=== Database Error ===');
      console.error('Error creating multiple services booking:', createError);
      return res.status(500).json({ 
        message: 'Failed to save multiple services booking',
        error: createError.message
      });
    }
  } catch (err) {
    console.error('=== Multiple Services Booking Error ===');
    console.error('Error:', err);
    return res.status(500).json({ 
      message: 'Failed to create multiple services booking',
      error: err.message
    });
  }
});

// Get customer's bookings
router.get('/customer', customerAuth, async (req, res) => {
  try {
    const bookings = await Booking.find({ customer: req.user.id })
      .populate('worker', 'name phone')
      .populate('childBookings', 'serviceTitle status worker amount') // Populate child bookings
      .populate('parentBooking', 'serviceTitle serviceBreakdown') // Populate parent booking
      .sort({ createdAt: -1 });
    
    console.log('Found bookings for customer:', {
      customerId: req.user.id,
      count: bookings.length,
      bookings: bookings.map(b => ({
        id: b._id,
        status: b.status,
        serviceType: b.serviceType,
        isMultipleService: b.isMultipleServiceBooking,
        hasChildBookings: b.childBookings && b.childBookings.length > 0,
        hasParentBooking: !!b.parentBooking
      }))
    });
    
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
      { booking: booking._id },
      { assignedWorker: req.user.id }
    );

    // If this is a child booking from a multiple service booking, update parent booking status
    if (booking.parentBooking) {
      const parentBooking = await Booking.findById(booking.parentBooking);
      if (parentBooking) {
        // Check if all child bookings have workers assigned
        const childBookings = await Booking.find({ parentBooking: parentBooking._id });
        const allAssigned = childBookings.every(child => child.worker);
        
        if (allAssigned) {
          parentBooking.status = 'Worker Assigned';
          await parentBooking.save();
        }
      }
    }

    // Create notification for customer
    await Notification.create({
      type: 'worker_assigned',
      user: booking.customer,
      userModel: 'Customer',
      title: 'Worker Assigned',
      message: `A worker has been assigned to your booking for ${booking.serviceTitle}`,
      data: { 
        bookingId: booking._id.toString(),
        parentBookingId: booking.parentBooking?.toString(),
        isMultipleService: !!booking.parentBooking
      },
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
        data: { 
          bookingId: booking._id.toString(),
          parentBookingId: booking.parentBooking?.toString(),
          isMultipleService: !!booking.parentBooking
        },
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
          bookingId: booking._id.toString(),
          parentBookingId: booking.parentBooking?.toString(),
          isMultipleService: !!booking.parentBooking
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
    console.log('🔍 Fetching booking with ID:', id);
    console.log('👤 User ID:', req.user.id);
    
    // Validate booking ID
    if (!id || id === 'undefined') {
      console.error('❌ Invalid booking ID:', id);
      return res.status(400).json({ message: 'Invalid booking ID' });
    }

    const booking = await Booking.findById(id)
      .populate('worker', 'name phone')
      .populate('customer', 'name phone email');
    
    if (!booking) {
      console.error('❌ Booking not found for ID:', id);
      return res.status(404).json({ message: 'Booking not found' });
    }

    console.log('✅ Booking found:', {
      bookingId: booking._id,
      customerId: booking.customer._id,
      userRequesting: req.user.id,
      status: booking.status
    });

    // Check if the booking belongs to the customer
    if (booking.customer._id.toString() !== req.user.id) {
      console.error('❌ Unauthorized access attempt:', {
        bookingCustomerId: booking.customer._id.toString(),
        requestingUserId: req.user.id
      });
      return res.status(403).json({ message: 'Unauthorized' });
    }

    console.log('✅ Authorized access granted, returning booking data');
    res.json(booking);
  } catch (err) {
    console.error('❌ Error fetching booking:', err);
    res.status(500).json({ message: 'Failed to fetch booking', error: err.message });
  }
});

// Get precise location information for an address
router.post('/geocode', customerAuth, async (req, res) => {
  try {
    const { address } = req.body;
    
    if (!address || !address.street || !address.city || !address.state || !address.pincode) {
      return res.status(400).json({ 
        message: 'Invalid address. Please provide street, city, state, and pincode' 
      });
    }

    const { geocodeAddress } = await import('../utils/distanceCalculator.js');
    const locationInfo = await geocodeAddress(address);
    
    if (!locationInfo) {
      return res.status(404).json({ 
        message: 'Could not find precise location for this address' 
      });
    }

    res.json({
      success: true,
      location: {
        latitude: locationInfo.latitude,
        longitude: locationInfo.longitude,
        displayName: locationInfo.displayName,
        accuracy: locationInfo.accuracy,
        accuracyPercentage: Math.round(locationInfo.accuracy * 100)
      }
    });
  } catch (err) {
    console.error('Geocoding error:', err);
    res.status(500).json({ 
      message: 'Failed to get location information', 
      error: err.message 
    });
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

// Add review/rating for a completed booking
router.post('/:id/review', customerAuth, async (req, res) => {
  try {
    const { rating, review } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (String(booking.customer) !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to review this booking' });
    }
    if (booking.status !== 'Completed') {
      return res.status(400).json({ message: 'You can only review completed bookings' });
    }
    if (booking.rating) {
      return res.status(400).json({ message: 'You have already reviewed this booking' });
    }
    booking.rating = rating;
    booking.review = review;
    await booking.save();
    // Update worker's average rating
    if (booking.worker) {
      const Worker = await import('../models/Worker.js').then(mod => mod.default);
      const worker = await Worker.findById(booking.worker);
      if (worker) {
        // Get all completed bookings with ratings for this worker
        const completedBookings = await Booking.find({ worker: worker._id, status: 'Completed', rating: { $exists: true } });
        const reviewCount = completedBookings.length;
        const totalRating = completedBookings.reduce((sum, b) => sum + (b.rating || 0), 0);
        worker.stats.averageRating = reviewCount > 0 ? totalRating / reviewCount : 0;
        worker.stats.reviewCount = reviewCount;
        await worker.save();
      }
    }
    res.json({ message: 'Review submitted successfully', booking });
  } catch (err) {
    res.status(500).json({ message: 'Failed to submit review', error: err.message });
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

// Payment verification endpoint
router.post('/verify-payment', customerAuth, async (req, res) => {
  try {
    console.log('🔍 Payment verification request received');
    const { bookingId, paidAmount, expectedAmount } = req.body;
    
    if (!bookingId || paidAmount === undefined || expectedAmount === undefined) {
      return res.status(400).json({ message: 'Booking ID, paid amount, and expected amount are required' });
    }
    
    // Find the booking
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    // Check if the booking belongs to the customer
    if (String(booking.customer) !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    console.log('💰 Payment verification details:', {
      bookingId,
      paidAmount,
      expectedAmount,
      bookingTotalAmount: booking.totalAmount
    });
    
    // Validate payment amount
    if (paidAmount !== expectedAmount) {
      console.log('❌ Payment amount mismatch');
      return res.status(400).json({ 
        message: `Payment verification failed! You paid ₹${paidAmount} but the required amount is ₹${expectedAmount}. Please pay the exact amount.`,
        paidAmount,
        expectedAmount,
        isValid: false
      });
    }
    
    // Update booking status to confirmed
    booking.status = 'Confirmed';
    booking.paymentVerified = true;
    booking.paidAmount = paidAmount;
    booking.paymentVerifiedAt = new Date();
    await booking.save();
    
    console.log('✅ Payment verified successfully for booking:', bookingId);
    
    // Create notification for customer
    await Notification.create({
      type: 'payment_success',
      user: req.user.id,
      userModel: 'Customer',
      title: 'Payment Verified Successfully',
      message: `Your payment of ₹${paidAmount} has been verified for ${booking.serviceTitle}`,
      data: { bookingId: booking._id.toString() },
      read: false
    });
    
    // Notify admin
    const Admin = await import('../models/Admin.js').then(mod => mod.default);
    const admins = await Admin.find();
    await Promise.all(admins.map(admin => 
      Notification.create({
        type: 'payment_verified',
        user: admin._id,
        userModel: 'Admin',
        title: 'Payment Verified',
        message: `Payment of ₹${paidAmount} verified for ${booking.serviceTitle}`,
        data: { bookingId: booking._id.toString() },
        read: false
      })
    ));
    
    res.json({ 
      success: true, 
      message: 'Payment verified successfully',
      bookingId: booking._id,
      paidAmount,
      expectedAmount,
      isValid: true
    });
  } catch (err) {
    console.error('❌ Payment verification error:', err);
    res.status(500).json({ message: 'Payment verification failed', error: err.message });
  }
});

// Get booking by order ID for payment verification
router.get('/order/:orderId', customerAuth, async (req, res) => {
  try {
    console.log('🔍 Checking payment status for order:', req.params.orderId);
    
    const { orderId } = req.params;
    
    if (!orderId) {
      return res.status(400).json({ message: 'Order ID is required' });
    }
    
    // Find booking by order ID (you might need to add this field to your booking model)
    // For now, we'll check if the booking exists and return payment status
    const booking = await Booking.findOne({ 
      customer: req.user.id,
      // Add any other criteria to identify the booking by order ID
      // For example: razorpayOrderId: orderId
    }).sort({ createdAt: -1 }); // Get the most recent booking
    
    if (!booking) {
      console.log('❌ No booking found for order:', orderId);
      return res.status(404).json({ 
        message: 'Booking not found',
        paymentVerified: false 
      });
    }
    
    console.log('✅ Booking found:', {
      bookingId: booking._id,
      status: booking.status,
      paymentVerified: booking.paymentVerified,
      serviceTitle: booking.serviceTitle
    });
    
    res.json({
      bookingId: booking._id,
      status: booking.status,
      paymentVerified: booking.paymentVerified || false,
      serviceTitle: booking.serviceTitle,
      amount: booking.totalAmount,
      createdAt: booking.createdAt
    });
    
  } catch (err) {
    console.error('❌ Error checking payment status:', err);
    res.status(500).json({ 
      message: 'Error checking payment status',
      paymentVerified: false,
      error: err.message 
    });
  }
});

// Test payment endpoint for development
router.post('/test-payment', customerAuth, async (req, res) => {
  try {
    console.log('🧪 Test payment request received');
    const { bookingId, amount } = req.body;
    
    if (!bookingId) {
      return res.status(400).json({ message: 'Booking ID is required' });
    }
    
    // Find the booking
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    // Check if the booking belongs to the customer
    if (String(booking.customer) !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    // Simulate payment processing
    console.log('✅ Test payment successful for booking:', bookingId);
    
    // Update booking status to confirmed (optional)
    booking.status = 'Confirmed';
    await booking.save();
    
    // Create notification for customer
    await Notification.create({
      type: 'payment_success',
      user: req.user.id,
      userModel: 'Customer',
      title: 'Payment Successful',
      message: `Test payment of ₹${amount || booking.totalAmount} was successful for ${booking.serviceTitle}`,
      data: { bookingId: booking._id.toString() },
      read: false
    });
    
    res.json({ 
      success: true, 
      message: 'Test payment successful',
      bookingId: booking._id,
      amount: amount || booking.totalAmount
    });
  } catch (err) {
    console.error('❌ Test payment error:', err);
    res.status(500).json({ message: 'Test payment failed', error: err.message });
  }
});

export default router;
