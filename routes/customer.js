import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Customer from '../models/Customer.js';
import { customerAuth, adminAuth } from '../middleware/auth.js';
import nodemailer from 'nodemailer';
import { upload } from '../utils/cloudinary.js';

const router = express.Router();

// Register new customer (with email verification)
router.post('/register', async (req, res) => {
  try {
    console.log('Register request body:', req.body); // Debug log
    
    // Validate required fields
    const { email, password, confirmPassword } = req.body;
    
    // Check for missing fields
    const missingFields = [];
    if (!email) missingFields.push('email');
    if (!password) missingFields.push('password');
    if (!confirmPassword) missingFields.push('confirmPassword');
    
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

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({ 
        message: 'Invalid password',
        errors: ['Password must be at least 6 characters long']
      });
    }

    // Validate password confirmation
    if (password !== confirmPassword) {
      return res.status(400).json({ 
        message: 'Password mismatch',
        errors: ['Passwords do not match']
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

    // Generate email verification OTP
    const verificationOTP = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Create new customer (unverified) with minimal data
    const customer = new Customer({
      name: email.split('@')[0], // Use email prefix as default name
      email: email.toLowerCase().trim(),
      phone: '', // Will be filled later
      password: hashedPassword,
      address: {},
      isVerified: false,
      emailVerificationOTP: verificationOTP,
      emailVerificationExpires: otpExpires
    });

    // Save customer
    await customer.save();

    // Send verification email
    try {
      await sendEmailVerificationOTP(email, verificationOTP, customer.name);
      console.log(`Email verification OTP sent to: ${email}`);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Don't fail registration if email fails, but log it
    }

    console.log('Customer registered successfully (pending verification):', customer.email);

    // Return success response (account created but not verified)
    res.status(201).json({
      message: 'Registration successful! Please check your email for verification OTP.',
      requiresVerification: true,
      user: {
        id: customer._id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        role: 'customer',
        isVerified: false
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

// Verify email with OTP
router.post('/verify-email', async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    if (!email || !otp) {
      return res.status(400).json({ 
        message: 'Email and OTP are required' 
      });
    }

    // Find customer by email
    const customer = await Customer.findOne({ email: email.toLowerCase() });
    if (!customer) {
      return res.status(404).json({ 
        message: 'Customer not found' 
      });
    }

    // Check if already verified
    if (customer.isVerified) {
      return res.status(400).json({ 
        message: 'Email is already verified' 
      });
    }

    // Check if OTP exists and is not expired
    if (!customer.emailVerificationOTP || !customer.emailVerificationExpires) {
      return res.status(400).json({ 
        message: 'No verification OTP found. Please register again.' 
      });
    }

    if (customer.emailVerificationExpires < new Date()) {
      return res.status(400).json({ 
        message: 'Verification OTP has expired. Please request a new one.' 
      });
    }

    // Verify OTP
    if (customer.emailVerificationOTP !== otp) {
      return res.status(400).json({ 
        message: 'Invalid OTP' 
      });
    }

    // Mark email as verified
    customer.isVerified = true;
    customer.emailVerificationOTP = undefined;
    customer.emailVerificationExpires = undefined;
    customer.lastLogin = new Date();
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

    console.log('Email verified successfully:', customer.email);

    res.json({
      message: 'Email verified successfully!',
      token,
      user: {
        id: customer._id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        role: 'customer',
        isVerified: true
      }
    });

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      message: 'Email verification failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
    });
  }
});

// Resend verification OTP
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        message: 'Email is required' 
      });
    }

    // Find customer by email
    const customer = await Customer.findOne({ email: email.toLowerCase() });
    if (!customer) {
      return res.status(404).json({ 
        message: 'Customer not found' 
      });
    }

    // Check if already verified
    if (customer.isVerified) {
      return res.status(400).json({ 
        message: 'Email is already verified' 
      });
    }

    // Generate new verification OTP
    const verificationOTP = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Update customer with new OTP
    customer.emailVerificationOTP = verificationOTP;
    customer.emailVerificationExpires = otpExpires;
    await customer.save();

    // Send new verification email
    try {
      await sendEmailVerificationOTP(email, verificationOTP, customer.name);
      console.log(`New email verification OTP sent to: ${email}`);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      return res.status(500).json({
        message: 'Failed to send verification email',
        error: 'Please try again later'
      });
    }

    res.json({
      message: 'New verification OTP sent to your email'
    });

  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({
      message: 'Failed to resend verification OTP',
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
    
    // Check if email is verified
    if (!customer.isVerified) {
      console.log('Unverified customer trying to login:', email);
      return res.status(403).json({ 
        message: 'Email not verified',
        requiresVerification: true,
        user: {
          id: customer._id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          address: customer.address,
          role: 'customer',
          isVerified: false
        }
      });
    }
    
    const token = jwt.sign({ id: customer._id, role: 'customer' }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    // Update last login
    customer.lastLogin = new Date();
    await customer.save();
    
    console.log('Customer logged in:', email);
    res.json({ 
      token, 
      user: { 
        id: customer._id, 
        name: customer.name, 
        email, 
        phone: customer.phone, 
        address: customer.address, 
        role: 'customer',
        isVerified: true
      } 
    });
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
    await sendPasswordResetEmailHelper(email, otp, customer.name);
    
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

// Upload customer profile image
router.post('/profile-image', customerAuth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file uploaded' });
    }
    
    // Cloudinary returns the optimized URL directly
    const imageUrl = req.file.path; // This is now the Cloudinary URL
    
    const customer = await Customer.findByIdAndUpdate(
      req.user.id,
      { profileImage: imageUrl },
      { new: true }
    ).select('-password');
    
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    res.json({ 
      message: 'Profile image updated', 
      profileImage: imageUrl, 
      customer,
      // Additional optimized URLs for different sizes
      responsiveUrls: {
        thumbnail: imageUrl.replace('/upload/', '/upload/w_150,h_150,c_fill/'),
        small: imageUrl.replace('/upload/', '/upload/w_300,h_300,c_fill/'),
        medium: imageUrl.replace('/upload/', '/upload/w_600,h_600,c_fill/'),
        large: imageUrl.replace('/upload/', '/upload/w_1000,h_1000,c_limit/')
      }
    });
  } catch (err) {
    console.error('Profile image upload error:', err);
    res.status(500).json({ message: 'Failed to upload profile image', error: err.message });
  }
});

import { sendPasswordResetEmail, sendEmailVerificationOTP } from '../utils/emailConfig.js';

// Helper function to send password reset email
async function sendPasswordResetEmailHelper(to, otp, customerName) {
  try {
    await sendPasswordResetEmail(to, otp, customerName);
    console.log(`Password reset OTP email sent successfully to ${to}`);
  } catch (emailError) {
    console.error('Failed to send password reset email:', emailError);
    console.log(`Generated OTP for password reset: ${otp}`);
    console.log(`Customer email: ${to}`);
    console.log(`Customer name: ${customerName}`);
    // Don't throw error - OTP is still generated and stored
  }
}

// Get customer profile
router.get('/profile', customerAuth, async (req, res) => {
  try {
    const customer = await Customer.findById(req.user.id).select('-password');
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    res.json(customer);
  } catch (err) {
    console.error('Error fetching customer profile:', err);
    res.status(500).json({ message: 'Failed to fetch profile', error: err.message });
  }
});

// Get customer statistics
router.get('/stats', customerAuth, async (req, res) => {
  try {
    const customerId = req.user.id;
    
    // Import Booking model
    const Booking = await import('../models/Booking.js').then(mod => mod.default);
    
    // Get total bookings
    const totalBookings = await Booking.countDocuments({ customer: customerId });
    
    // Get completed bookings for rating calculation
    const completedBookings = await Booking.find({ 
      customer: customerId, 
      status: 'Completed' 
    });
    
    // Calculate average rating from completed bookings
    let averageRating = 0;
    if (completedBookings.length > 0) {
      const totalRating = completedBookings.reduce((sum, booking) => {
        return sum + (booking.rating || 0);
      }, 0);
      averageRating = totalRating / completedBookings.length;
    }
    
    // Calculate total spent from completed bookings
    const totalSpent = completedBookings.reduce((sum, booking) => {
      return sum + (booking.amount || 0);
    }, 0);
    
    res.json({
      totalBookings,
      averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal place
      totalSpent
    });
  } catch (err) {
    console.error('Error fetching customer stats:', err);
    res.status(500).json({ message: 'Failed to fetch statistics', error: err.message });
  }
});

// Admin: Get all customers
router.get('/admin/all', adminAuth, async (req, res) => {
  try {
    const customers = await Customer.find().select('-password').sort({ createdAt: -1 });
    res.json(customers);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch customers', error: err.message });
  }
});

// Admin: Get customer by ID
router.get('/admin/:id', adminAuth, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id).select('-password');
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    res.json(customer);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch customer', error: err.message });
  }
});

// Admin: Update customer status
router.put('/admin/:id/status', adminAuth, async (req, res) => {
  try {
    const { isActive } = req.body;
    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true, select: '-password' }
    );
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    res.json(customer);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update customer status', error: err.message });
  }
});

// Admin: Delete customer
router.delete('/admin/:id', adminAuth, async (req, res) => {
  try {
    const customer = await Customer.findByIdAndDelete(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    res.json({ message: 'Customer deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete customer', error: err.message });
  }
});

export default router;
