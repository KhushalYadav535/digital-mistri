import express from 'express';
import { adminAuth } from '../middleware/auth.js';
import Worker from '../models/Worker.js';
import Customer from '../models/Customer.js';
import Booking from '../models/Booking.js';
import Service from '../models/Service.js';

const router = express.Router();

// GET /api/admin/analytics/overview
router.get('/overview', adminAuth, async (req, res) => {
  try {
    // Revenue & job stats
    const workers = await Worker.find();
    let totalRevenue = 0;
    let totalJobs = 0;
    let activeJobs = 0;
    const serviceMap = {};
    workers.forEach(worker => {
      const stats = worker.stats || {};
      totalRevenue += stats.totalEarnings || 0;
      totalJobs += stats.totalBookings || 0;
      // For demo, treat completedBookings < totalBookings as active jobs
      activeJobs += (stats.totalBookings || 0) - (stats.completedBookings || 0);
      (worker.services || []).forEach(service => {
        if (!serviceMap[service]) serviceMap[service] = { totalJobs: 0, activeJobs: 0, revenue: 0 };
        serviceMap[service].totalJobs += stats.totalBookings || 0;
        serviceMap[service].activeJobs += (stats.totalBookings || 0) - (stats.completedBookings || 0);
        serviceMap[service].revenue += stats.totalEarnings || 0;
      });
    });
    // Top performing workers
    const topWorkers = workers
      .map(w => ({
        name: w.name,
        jobs: w.stats?.completedBookings || 0,
        rating: w.stats?.rating || 4.5 // fallback rating
      }))
      .sort((a, b) => b.jobs - a.jobs)
      .slice(0, 3);
    // New workers (created most recently)
    const newWorkers = workers
      .slice()
      .reverse()
      .slice(0, 3)
      .map(w => ({
        name: w.name,
        jobs: w.stats?.completedBookings || 0,
        rating: w.stats?.rating || 4.5
      }));
    res.json({
      revenue: {
        total: totalRevenue,
        daily: Math.round(totalRevenue / 30),
        weekly: Math.round(totalRevenue / 4),
        monthly: totalRevenue
      },
      services: Object.entries(serviceMap).map(([name, stats]) => ({ name, ...stats })),
      topWorkers,
      newWorkers,
      totalWorkers: workers.length,
      activeJobs,
      totalEarnings: totalRevenue,
      newRequests: 0 // Replace with actual new requests count if available
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch analytics' });
  }
});

// GET /api/admin/analytics/revenue
router.get('/revenue', adminAuth, async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const now = new Date();
    let startDate;
    
    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const bookings = await Booking.find({
      createdAt: { $gte: startDate },
      status: 'Completed'
    });

    const totalRevenue = bookings.reduce((sum, booking) => sum + (booking.amount || 0), 0);
    const totalBookings = bookings.length;
    const averageRevenue = totalBookings > 0 ? totalRevenue / totalBookings : 0;

    res.json({
      period,
      totalRevenue,
      totalBookings,
      averageRevenue,
      dailyRevenue: period === 'week' ? Math.round(totalRevenue / 7) : Math.round(totalRevenue / 30)
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch revenue analytics', error: err.message });
  }
});

// GET /api/admin/analytics/worker-performance
router.get('/worker-performance', adminAuth, async (req, res) => {
  try {
    const workers = await Worker.find();
    const workerStats = workers.map(worker => ({
      id: worker._id,
      name: worker.name,
      email: worker.email,
      phone: worker.phone,
      isVerified: worker.isVerified,
      isAvailable: worker.isAvailable,
      services: worker.services,
      stats: {
        totalBookings: worker.stats?.totalBookings || 0,
        completedBookings: worker.stats?.completedBookings || 0,
        totalEarnings: worker.stats?.totalEarnings || 0,
        averageRating: worker.stats?.rating || 0
      },
      performance: {
        completionRate: worker.stats?.totalBookings > 0 
          ? (worker.stats.completedBookings / worker.stats.totalBookings * 100).toFixed(1)
          : 0,
        averageEarnings: worker.stats?.completedBookings > 0
          ? worker.stats.totalEarnings / worker.stats.completedBookings
          : 0
      }
    }));

    // Sort by completion rate
    workerStats.sort((a, b) => parseFloat(b.performance.completionRate) - parseFloat(a.performance.completionRate));

    res.json(workerStats);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch worker performance', error: err.message });
  }
});

// GET /api/admin/analytics/customer-stats
router.get('/customer-stats', adminAuth, async (req, res) => {
  try {
    const customers = await Customer.find();
    const bookings = await Booking.find();

    const customerStats = customers.map(customer => {
      const customerBookings = bookings.filter(booking => 
        booking.customer.toString() === customer._id.toString()
      );
      
      const totalSpent = customerBookings
        .filter(booking => booking.status === 'Completed')
        .reduce((sum, booking) => sum + (booking.amount || 0), 0);

      return {
        id: customer._id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        stats: {
          totalBookings: customerBookings.length,
          completedBookings: customerBookings.filter(b => b.status === 'Completed').length,
          cancelledBookings: customerBookings.filter(b => b.status === 'Cancelled').length,
          totalSpent
        }
      };
    });

    // Sort by total spent
    customerStats.sort((a, b) => b.stats.totalSpent - a.stats.totalSpent);

    res.json(customerStats);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch customer stats', error: err.message });
  }
});

// GET /api/admin/analytics/service-stats
router.get('/service-stats', adminAuth, async (req, res) => {
  try {
    const services = await Service.find();
    const bookings = await Booking.find();

    const serviceStats = services.map(service => {
      const serviceBookings = bookings.filter(booking => 
        booking.serviceType === service.name || booking.serviceTitle === service.name
      );

      const completedBookings = serviceBookings.filter(b => b.status === 'Completed');
      const totalRevenue = completedBookings.reduce((sum, booking) => sum + (booking.amount || 0), 0);

      return {
        id: service._id,
        name: service.name,
        description: service.description,
        rate: service.rate,
        isActive: service.isActive,
        stats: {
          totalBookings: serviceBookings.length,
          completedBookings: completedBookings.length,
          cancelledBookings: serviceBookings.filter(b => b.status === 'Cancelled').length,
          totalRevenue,
          averageRevenue: completedBookings.length > 0 ? totalRevenue / completedBookings.length : 0
        }
      };
    });

    // Sort by total revenue
    serviceStats.sort((a, b) => b.stats.totalRevenue - a.stats.totalRevenue);

    res.json(serviceStats);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch service stats', error: err.message });
  }
});

export default router;
