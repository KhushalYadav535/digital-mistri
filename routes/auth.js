import express from 'express';
import jwt from 'jsonwebtoken';
import { customerAuth, workerAuth, adminAuth } from '../middleware/auth.js';
import Customer from '../models/Customer.js';
import Worker from '../models/Worker.js';
import Admin from '../models/Admin.js';

const router = express.Router();

// Verify token endpoint
router.get('/verify', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (!decoded || !decoded.id || !decoded.role) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    // Check if user still exists in database
    let user = null;
    
    switch (decoded.role) {
      case 'customer':
        user = await Customer.findById(decoded.id).select('-password');
        break;
      case 'worker':
        user = await Worker.findById(decoded.id).select('-password');
        break;
      case 'admin':
        user = await Admin.findById(decoded.id).select('-password');
        break;
      default:
        return res.status(401).json({ message: 'Invalid user role' });
    }

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Return user data
    res.json({
      valid: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: decoded.role,
        phone: user.phone,
        address: user.address
      }
    });

  } catch (error) {
    console.error('Token verification error:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    
    res.status(500).json({ message: 'Token verification failed' });
  }
});

// Refresh token endpoint
router.post('/refresh-token', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.substring(7);
    
    // Verify the current token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (!decoded || !decoded.id || !decoded.role) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    // Check if user still exists
    let user = null;
    
    switch (decoded.role) {
      case 'customer':
        user = await Customer.findById(decoded.id);
        break;
      case 'worker':
        user = await Worker.findById(decoded.id);
        break;
      case 'admin':
        user = await Admin.findById(decoded.id);
        break;
      default:
        return res.status(401).json({ message: 'Invalid user role' });
    }

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Generate new token
    const newToken = jwt.sign(
      { id: user._id, role: decoded.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token: newToken });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({ message: 'Token refresh failed' });
  }
});

export default router; 