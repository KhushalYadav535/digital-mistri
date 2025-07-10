import express from 'express';
import Support from '../models/Support.js';
import Customer from '../models/Customer.js';
import { customerAuth } from '../middleware/auth.js';
import nodemailer from 'nodemailer';

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
    await sendSupportEmail(customer, message.trim());

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
async function sendSupportEmail(customer, message) {
  // Check if email credentials are configured
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('SMTP credentials not set. Support message will be saved but not sent via email.');
    console.log('=== Support Message (Email not configured) ===');
    console.log(`From: ${customer.name} (${customer.email})`);
    console.log(`Phone: ${customer.phone}`);
    console.log(`Message: ${message}`);
    console.log('=============================================');
    return;
  }
  
  try {
    const transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: 'digitalmistri33@gmail.com',
      subject: `Support Request from ${customer.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #007AFF; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">Digital Mistri</h1>
            <p style="margin: 5px 0 0 0; font-size: 16px;">New Support Request</p>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-bottom: 20px;">Customer Details</h2>
            
            <div style="background-color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <p style="margin: 5px 0; color: #666;"><strong>Name:</strong> ${customer.name}</p>
              <p style="margin: 5px 0; color: #666;"><strong>Email:</strong> ${customer.email}</p>
              <p style="margin: 5px 0; color: #666;"><strong>Phone:</strong> ${customer.phone}</p>
              <p style="margin: 5px 0; color: #666;"><strong>Date:</strong> ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
            </div>
            
            <h3 style="color: #333; margin-bottom: 15px;">Message</h3>
            <div style="background-color: white; padding: 20px; border-radius: 8px; border-left: 4px solid #007AFF;">
              <p style="color: #333; line-height: 1.6; margin: 0; white-space: pre-wrap;">${message}</p>
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
              <p style="color: #999; font-size: 12px;">
                This is an automated email from Digital Mistri support system.
              </p>
            </div>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
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