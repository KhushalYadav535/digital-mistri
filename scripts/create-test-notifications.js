import mongoose from 'mongoose';
import Notification from '../models/Notification.js';
import Customer from '../models/Customer.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/digital-mistri';

async function createTestNotifications() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find a customer
    const customer = await Customer.findOne();
    if (!customer) {
      console.log('No customer found. Please create a customer first.');
      return;
    }

    console.log('Creating test notifications for customer:', customer.name);

    // Create test notifications
    const testNotifications = [
      {
        type: 'booking_created',
        user: customer._id,
        userModel: 'Customer',
        title: 'Booking Created Successfully',
        message: 'Your booking for Plumbing Service has been created and is pending worker assignment.',
        data: { bookingId: '507f1f77bcf86cd799439011' },
        read: false,
        createdAt: new Date(Date.now() - 1000 * 60 * 5) // 5 minutes ago
      },
      {
        type: 'worker_assigned',
        user: customer._id,
        userModel: 'Customer',
        title: 'Worker Assigned',
        message: 'A worker has been assigned to your booking for Plumbing Service.',
        data: { bookingId: '507f1f77bcf86cd799439011' },
        read: false,
        createdAt: new Date(Date.now() - 1000 * 60 * 3) // 3 minutes ago
      },
      {
        type: 'booking_completed',
        user: customer._id,
        userModel: 'Customer',
        title: 'Service Completed',
        message: 'Your plumbing service has been completed successfully. Please rate your experience.',
        data: { bookingId: '507f1f77bcf86cd799439011' },
        read: false,
        createdAt: new Date(Date.now() - 1000 * 60 * 1) // 1 minute ago
      },
      {
        type: 'payment_success',
        user: customer._id,
        userModel: 'Customer',
        title: 'Payment Successful',
        message: 'Payment of ₹500 for Plumbing Service has been processed successfully.',
        data: { amount: 500, serviceType: 'Plumbing' },
        read: true,
        createdAt: new Date(Date.now() - 1000 * 60 * 10) // 10 minutes ago
      },
      {
        type: 'service_available',
        user: customer._id,
        userModel: 'Customer',
        title: 'New Service Available',
        message: 'Electrician service is now available in your area.',
        data: { serviceType: 'Electrician' },
        read: false,
        createdAt: new Date(Date.now() - 1000 * 60 * 15) // 15 minutes ago
      }
    ];

    // Clear existing test notifications
    await Notification.deleteMany({
      user: customer._id,
      userModel: 'Customer'
    });

    // Create new test notifications
    const createdNotifications = await Notification.insertMany(testNotifications);

    console.log('Created', createdNotifications.length, 'test notifications');
    console.log('Notification IDs:', createdNotifications.map(n => n._id));

    // Show notification count
    const unreadCount = await Notification.countDocuments({
      user: customer._id,
      userModel: 'Customer',
      read: false
    });

    console.log('Unread notifications:', unreadCount);

  } catch (error) {
    console.error('Error creating test notifications:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

createTestNotifications(); 