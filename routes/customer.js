import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Customer from '../models/Customer.js';
import { customerAuth } from '../middleware/auth.js';
import nodemailer from 'nodemailer';

const router = express.Router();

// Register new customer
router.post('/register', async (req, res) => {
  try {
    console.log('Register request body:', req.body); // Debug log
    
    // Validate required fields
    const { name, email, phone, password, address } = req.body;
    
    // Check for missing fields
    const missingFields = [];
    if (!name) missingFields.push('name');
    if (!email) missingFields.push('email');
    if (!phone) missingFields.push('phone');
    if (!password) missingFields.push('password');
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        message: 'Missing required fields', 
        fields: missingFields 
      });
    }

    // Validate email format
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        message: 'Invalid email format',
        errors: ['Please enter a valid email address']
      });
    }

    // Validate phone format
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ 
        message: 'Invalid phone number',
        errors: ['Phone number must be 10 digits']
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({ 
        message: 'Invalid password',
        errors: ['Password must be at least 6 characters long']
      });
    }

    // Check if email already exists
    const existingCustomer = await Customer.findOne({ email: email.toLowerCase() });
    if (existingCustomer) {
      return res.status(409).json({ 
        message: 'Email already registered',
        errors: ['This email is already registered']
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new customer
    const customer = new Customer({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      password: hashedPassword,
      address: address || {}
    });

    // Save customer
    await customer.save();

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: customer._id, 
        role: 'customer',
        email: customer.email 
      }, 
      process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );

    // Update last login
    customer.lastLogin = new Date();
    await customer.save();

    console.log('Customer registered successfully:', customer.email);

    // Return success response
    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: customer._id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        role: 'customer'
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    
    // Handle specific error types
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        message: 'Validation error',
        errors
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({
        message: 'Email already registered',
        errors: ['This email is already registered']
      });
    }

    // Generic error response
    res.status(500).json({
      message: 'Registration failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
    });
  }
});

// Login customer
router.post('/login', async (req, res) => {
  try {
    console.log('Login request body:', req.body); // Debug log
    const { email, password } = req.body;
    if (!email || !password) {
      console.log('Missing credentials');
      return res.status(400).json({ message: 'Missing credentials' });
    }
    const customer = await Customer.findOne({ email });
    if (!customer) {
      console.log('Customer not found:', email);
      return res.status(404).json({ message: 'Customer not found' });
    }
    const valid = await bcrypt.compare(password, customer.password);
    if (!valid) {
      console.log('Invalid credentials for:', email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: customer._id, role: 'customer' }, process.env.JWT_SECRET, { expiresIn: '7d' });
    console.log('Customer logged in:', email);
    res.json({ token, user: { id: customer._id, name: customer.name, email, phone: customer.phone, address: customer.address, role: 'customer' } });
  } catch (err) {
    console.log('Login error:', err);
    res.status(500).json({ message: 'Login failed', error: err.message });
  }
});

// Get customer profile
router.get('/profile', customerAuth, async (req, res) => {
  try {
    const customer = await Customer.findById(req.user.id).select('-password');
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    res.json(customer);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch profile', error: err.message });
  }
});

// Update customer profile
router.put('/profile', customerAuth, async (req, res) => {
  try {
    const { name, phone, address } = req.body;
    
    // Validate required fields
    if (name && name.trim().length < 2) {
      return res.status(400).json({ message: 'Name must be at least 2 characters long' });
    }
    
    if (phone && !/^[0-9]{10}$/.test(phone)) {
      return res.status(400).json({ message: 'Phone number must be 10 digits' });
    }
    
    // Validate address fields if provided
    if (address) {
      if (address.street && address.street.trim().length === 0) {
        return res.status(400).json({ message: 'Street address cannot be empty' });
      }
      if (address.city && address.city.trim().length === 0) {
        return res.status(400).json({ message: 'City cannot be empty' });
      }
      if (address.state && address.state.trim().length === 0) {
        return res.status(400).json({ message: 'State cannot be empty' });
      }
      if (address.pincode && !/^[0-9]{6}$/.test(address.pincode)) {
        return res.status(400).json({ message: 'Pincode must be 6 digits' });
      }
    }
    
    const updates = {};
    if (name) updates.name = name.trim();
    if (phone) updates.phone = phone.trim();
    if (address) updates.address = address;
    
    const customer = await Customer.findByIdAndUpdate(req.user.id, updates, { new: true }).select('-password');
    res.json(customer);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update profile', error: err.message });
  }
});

// Change password
router.put('/change-password', customerAuth, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) return res.status(400).json({ message: 'Missing fields' });
    const customer = await Customer.findById(req.user.id);
    const valid = await bcrypt.compare(oldPassword, customer.password);
    if (!valid) return res.status(401).json({ message: 'Incorrect old password' });
    customer.password = await bcrypt.hash(newPassword, 10);
    await customer.save();
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to change password', error: err.message });
  }
});

// Forgot password - send OTP
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const customer = await Customer.findOne({ email: email.toLowerCase() });
    if (!customer) {
      return res.status(404).json({ message: 'No account found with this email address' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store OTP in customer document (in production, use Redis or similar)
    customer.resetPasswordOTP = otp;
    customer.resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await customer.save();

    // Send OTP via email
    await sendPasswordResetEmail(email, otp, customer.name);
    
    res.json({ message: 'OTP sent successfully to your email' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ message: 'Failed to send OTP', error: err.message });
  }
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    const customer = await Customer.findOne({ email: email.toLowerCase() });
    if (!customer) {
      return res.status(404).json({ message: 'No account found with this email address' });
    }

    if (!customer.resetPasswordOTP || !customer.resetPasswordExpires) {
      return res.status(400).json({ message: 'No OTP request found' });
    }

    if (new Date() > customer.resetPasswordExpires) {
      return res.status(400).json({ message: 'OTP has expired' });
    }

    if (customer.resetPasswordOTP !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    res.json({ message: 'OTP verified successfully' });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ message: 'Failed to verify OTP', error: err.message });
  }
});

// Reset password
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: 'Email, OTP, and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    const customer = await Customer.findOne({ email: email.toLowerCase() });
    if (!customer) {
      return res.status(404).json({ message: 'No account found with this email address' });
    }

    if (!customer.resetPasswordOTP || !customer.resetPasswordExpires) {
      return res.status(400).json({ message: 'No OTP request found' });
    }

    if (new Date() > customer.resetPasswordExpires) {
      return res.status(400).json({ message: 'OTP has expired' });
    }

    if (customer.resetPasswordOTP !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    // Update password
    customer.password = await bcrypt.hash(newPassword, 10);
    customer.resetPasswordOTP = undefined;
    customer.resetPasswordExpires = undefined;
    await customer.save();

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ message: 'Failed to reset password', error: err.message });
  }
});

// Helper function to send password reset email
async function sendPasswordResetEmail(to, otp, customerName) {
  // Check if email credentials are configured
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('SMTP credentials not set. OTP will be generated but not sent via email.');
    console.log(`Generated OTP for password reset: ${otp}`);
    console.log(`Customer email: ${to}`);
    console.log(`Customer name: ${customerName}`);
    // Return without throwing error - OTP is still generated and stored
    return;
  }
  
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: to,
      subject: 'Password Reset OTP - Digital Mistri',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #007AFF; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">Digital Mistri</h1>
            <p style="margin: 5px 0 0 0; font-size: 16px;">Password Reset Request</p>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-bottom: 20px;">Hello ${customerName},</h2>
            
            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
              We received a request to reset your password for your Digital Mistri account. 
              Use the OTP below to complete your password reset:
            </p>
            
            <div style="background-color: #007AFF; color: white; padding: 20px; text-align: center; border-radius: 8px; margin: 30px 0;">
              <h1 style="margin: 0; font-size: 32px; letter-spacing: 5px;">${otp}</h1>
              <p style="margin: 10px 0 0 0; font-size: 14px;">Your 6-digit OTP</p>
            </div>
            
            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
              <strong>Important:</strong>
            </p>
            <ul style="color: #666; line-height: 1.6; margin-bottom: 20px;">
              <li>This OTP is valid for 10 minutes only</li>
              <li>Do not share this OTP with anyone</li>
              <li>If you didn't request this, please ignore this email</li>
            </ul>
            
            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
              If you have any questions, please contact our support team.
            </p>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
              <p style="color: #999; font-size: 12px;">
                This is an automated email. Please do not reply to this message.
              </p>
            </div>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`Password reset OTP email sent successfully to ${to}`);
  } catch (emailError) {
    console.error('Failed to send password reset email:', emailError);
    console.log(`Generated OTP for password reset: ${otp}`);
    console.log(`Customer email: ${to}`);
    console.log(`Customer name: ${customerName}`);
    // Don't throw error - OTP is still generated and stored
  }
}

export default router;
