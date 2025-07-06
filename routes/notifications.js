import express from 'express';
import Notification from '../models/Notification.js';
import { customerAuth, workerAuth, adminAuth } from '../middleware/auth.js';

const router = express.Router();

// Get notifications for customer
router.get('/customer', customerAuth, async (req, res) => {
  try {
    const notifications = await Notification.find({ 
      user: req.user.id, 
      userModel: 'Customer' 
    })
    .sort({ createdAt: -1 })
    .limit(50);
    
    res.json({ notifications });
  } catch (err) {
    console.error('Error fetching customer notifications:', err);
    res.status(500).json({ message: 'Failed to fetch notifications', error: err.message });
  }
});

// Get notifications for worker
router.get('/worker', workerAuth, async (req, res) => {
  try {
    const notifications = await Notification.find({ 
      user: req.user.id, 
      userModel: 'Worker' 
    })
    .sort({ createdAt: -1 })
    .limit(50);
    
    res.json({ notifications });
  } catch (err) {
    console.error('Error fetching worker notifications:', err);
    res.status(500).json({ message: 'Failed to fetch notifications', error: err.message });
  }
});

// Get notifications for admin
router.get('/admin', adminAuth, async (req, res) => {
  try {
    const notifications = await Notification.find({ 
      user: req.user.id, 
      userModel: 'Admin' 
    })
    .sort({ createdAt: -1 })
    .limit(50);
    
    res.json({ notifications });
  } catch (err) {
    console.error('Error fetching admin notifications:', err);
    res.status(500).json({ message: 'Failed to fetch notifications', error: err.message });
  }
});

// Mark notification as read
router.patch('/:id/read', customerAuth, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    // Check if user owns this notification
    if (notification.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    notification.read = true;
    await notification.save();
    
    res.json({ message: 'Notification marked as read', notification });
  } catch (err) {
    console.error('Error marking notification as read:', err);
    res.status(500).json({ message: 'Failed to mark notification as read', error: err.message });
  }
});

// Mark notification as read (PUT method for frontend compatibility)
router.put('/:id/read', customerAuth, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    // Check if user owns this notification
    if (notification.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    notification.read = true;
    await notification.save();
    
    res.json({ message: 'Notification marked as read', notification });
  } catch (err) {
    console.error('Error marking notification as read:', err);
    res.status(500).json({ message: 'Failed to mark notification as read', error: err.message });
  }
});

// Mark all notifications as read
router.patch('/mark-all-read', customerAuth, async (req, res) => {
  try {
    const { userModel } = req.body;
    
    if (!userModel || !['Customer', 'Worker', 'Admin'].includes(userModel)) {
      return res.status(400).json({ message: 'Invalid user model' });
    }
    
    await Notification.updateMany(
      { user: req.user.id, userModel: userModel, read: false },
      { read: true }
    );
    
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error('Error marking all notifications as read:', err);
    res.status(500).json({ message: 'Failed to mark notifications as read', error: err.message });
  }
});

// Delete notification
router.delete('/:id', customerAuth, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    // Check if user owns this notification
    if (notification.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    await Notification.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Notification deleted successfully' });
  } catch (err) {
    console.error('Error deleting notification:', err);
    res.status(500).json({ message: 'Failed to delete notification', error: err.message });
  }
});

// Get unread notification count
router.get('/unread-count', customerAuth, async (req, res) => {
  try {
    const { userModel } = req.query;
    
    if (!userModel || !['Customer', 'Worker', 'Admin'].includes(userModel)) {
      return res.status(400).json({ message: 'Invalid user model' });
    }
    
    const count = await Notification.countDocuments({
      user: req.user.id,
      userModel: userModel,
      read: false
    });
    
    res.json({ unreadCount: count });
  } catch (err) {
    console.error('Error getting unread count:', err);
    res.status(500).json({ message: 'Failed to get unread count', error: err.message });
  }
});

// Get notification count for customer
router.get('/customer/:userId/count', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Validate userId
    if (!userId || userId === 'undefined' || userId === 'null') {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    // Validate ObjectId format
    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }

    const count = await Notification.countDocuments({
      user: userId,
      userModel: 'Customer',
      read: false
    });
    
    res.json({ count });
  } catch (err) {
    console.error('Error getting notification count:', err);
    res.status(500).json({ message: 'Failed to get notification count', error: err.message });
  }
});

// Clear all notifications for customer
router.delete('/customer/:userId/clear-all', async (req, res) => {
  try {
    await Notification.deleteMany({
      user: req.params.userId,
      userModel: 'Customer'
    });
    
    res.json({ message: 'All notifications cleared successfully' });
  } catch (err) {
    console.error('Error clearing notifications:', err);
    res.status(500).json({ message: 'Failed to clear notifications', error: err.message });
  }
});

export default router; 