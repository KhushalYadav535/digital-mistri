import express from 'express';
import { adminAuth } from '../middleware/auth.js';
import Worker from '../models/Worker.js';

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

export default router;
