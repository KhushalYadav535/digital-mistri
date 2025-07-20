import express from 'express';
import Support from '../models/Support.js';
import Customer from '../models/Customer.js';
import { customerAuth } from '../middleware/auth.js';
import nodemailer from 'nodemailer';
import { sendSupportEmail } from '../utils/emailConfig.js';

const router = express.Router();

// Customer sends support message
router.post('/', customerAuth, async (req, res) => {
  try {
    const { message } = req.body;
    const customerId = req.user.id;

    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Message is required' });
    }

    // Get customer details for email
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Save support request to database
    const supportRequest = await Support.create({
      customer: customerId,
      message: message.trim()
    });

    // Send email to support team
    await sendSupportEmailHelper(customer, message.trim());

    res.status(201).json({ 
      success: true, 
      message: 'Support request sent successfully',
      supportId: supportRequest._id
    });

  } catch (error) {
    console.error('Support request error:', error);
    res.status(500).json({ 
      message: 'Failed to send support request', 
      error: error.message 
    });
  }
});

// Helper function to send support email
async function sendSupportEmailHelper(customer, message) {
  try {
    await sendSupportEmail(customer, message);
    console.log(`Support email sent successfully to digitalmistri33@gmail.com from ${customer.email}`);
  } catch (emailError) {
    console.error('Failed to send support email:', emailError);
    console.log('=== Support Message (Email failed) ===');
    console.log(`From: ${customer.name} (${customer.email})`);
    console.log(`Phone: ${customer.phone}`);
    console.log(`Message: ${message}`);
    console.log('=====================================');
    // Don't throw error - support request is still saved in database
  }
}

// Admin: Get all support requests
router.get('/', customerAuth, async (req, res) => {
  try {
    const supportRequests = await Support.find({ customer: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50);
    
    res.json({ supportRequests });
  } catch (error) {
    console.error('Error fetching support requests:', error);
    res.status(500).json({ 
      message: 'Failed to fetch support requests', 
      error: error.message 
    });
  }
});

export default router; 