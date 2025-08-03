import express from 'express';
import Job from '../models/Job.js';
import Worker from '../models/Worker.js';
import Customer from '../models/Customer.js';
import Notification from '../models/Notification.js';
import { adminAuth, workerAuth, customerAuth } from '../middleware/auth.js';

const router = express.Router();

// CUSTOMER: Book a service (create job)
router.post('/book', customerAuth, async (req, res) => {
  try {
    const { service, details } = req.body;
    // Find all available workers for this service
    const workers = await Worker.find({ services: service });
    if (!workers.length) return res.status(404).json({ message: 'No workers available for this service' });
    const job = await Job.create({
      service,
      customer: req.user.id,
      candidateWorkers: workers.map(w => w._id),
      details,
      status: 'Pending',
    });
    // Notify all candidate workers
    await Promise.all(workers.map(w => Notification.create({
      type: 'job_assigned',
      user: w._id,
      userModel: 'Worker',
      job: job._id,
      message: `New job request for service: ${service}`
    })));
    // Notify all admins
    const admins = await import('../models/Admin.js').then(mod => mod.default.find());
    await Promise.all(admins.map(a => Notification.create({
      type: 'job_booked',
      user: a._id,
      userModel: 'Admin',
      job: job._id,
      message: `New job booked by customer` 
    })));
    res.status(201).json(job);
  } catch (err) {
    res.status(500).json({ message: 'Failed to book service', error: err.message });
  }
});

// WORKER: Get pending jobs assigned to me (to accept/reject)
router.get('/pending', workerAuth, async (req, res) => {
  try {
    const jobs = await Job.find({ candidateWorkers: req.user.id, status: 'Pending', rejectedBy: { $ne: req.user.id } });
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch pending jobs', error: err.message });
  }
});

// WORKER: Accept a job
router.post('/:id/accept', workerAuth, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    if (!job.candidateWorkers.includes(req.user.id)) return res.status(403).json({ message: 'Not authorized' });
    if (job.status !== 'Pending') return res.status(400).json({ message: 'Job already processed' });
    job.assignedWorker = req.user.id;
    job.status = 'Accepted';
    job.acceptedAt = new Date();
    await job.save();
    // Notify worker
    await Notification.create({
      type: 'job_accepted',
      user: req.user.id,
      userModel: 'Worker',
      job: job._id,
      message: `You have accepted the job for service: ${job.service}`
    });
    // Notify all admins
    const admins = await import('../models/Admin.js').then(mod => mod.default.find());
    await Promise.all(admins.map(a => Notification.create({
      type: 'job_accepted',
      user: a._id,
      userModel: 'Admin',
      job: job._id,
      message: `Job accepted by worker` 
    })));
    res.json({ message: 'Job accepted', job });
  } catch (err) {
    res.status(500).json({ message: 'Failed to accept job', error: err.message });
  }
});

// WORKER: Reject a job (send to next worker)
router.post('/:id/reject', workerAuth, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    if (!job.candidateWorkers.includes(req.user.id)) return res.status(403).json({ message: 'Not authorized' });
    if (job.status !== 'Pending') return res.status(400).json({ message: 'Job already processed' });
    job.rejectedBy.push(req.user.id);
    // Remove this worker from candidates
    job.candidateWorkers = job.candidateWorkers.filter(w => w.toString() !== req.user.id);
    // If no candidates left, mark as rejected
    if (job.candidateWorkers.length === 0) {
      job.status = 'Rejected';
      // Notify all admins
      const admins = await import('../models/Admin.js').then(mod => mod.default.find());
      await Promise.all(admins.map(a => Notification.create({
        type: 'job_rejected',
        user: a._id,
        userModel: 'Admin',
        job: job._id,
        message: `Job rejected by all workers` 
      })));
    } else {
      // Notify next available worker (first in list)
      const nextWorker = job.candidateWorkers[0];
      await Notification.create({
        type: 'job_assigned',
        user: nextWorker,
        userModel: 'Worker',
        job: job._id,
        message: `You have a new job request for service: ${job.service}`
      });
    }
    await job.save();
    // Notify rejecting worker
    await Notification.create({
      type: 'job_rejected',
      user: req.user.id,
      userModel: 'Worker',
      job: job._id,
      message: `You have rejected the job for service: ${job.service}`
    });
    res.json({ message: 'Job rejected', job });
  } catch (err) {
    res.status(500).json({ message: 'Failed to reject job', error: err.message });
  }
});

// WORKER: Complete a job
router.post('/:id/complete', workerAuth, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    if (job.assignedWorker.toString() !== req.user.id) return res.status(403).json({ message: 'Not authorized' });
    if (job.status !== 'Accepted') return res.status(400).json({ message: 'Job not in accepted state' });

    // Update job status
    job.status = 'Completed';
    job.completedAt = new Date();
    await job.save();

    // Update worker's earnings
    const worker = await Worker.findById(req.user.id);
    if (worker) {
      const jobAmount = job.details?.amount || 0;
      // Calculate worker payment (80% of service amount)
      const workerPayment = Math.round(jobAmount * 0.80);
      worker.stats.totalEarnings = (worker.stats.totalEarnings || 0) + workerPayment;
      worker.stats.completedBookings = (worker.stats.completedBookings || 0) + 1;
      
      // Add new earnings entry
      worker.stats.earnings = worker.stats.earnings || [];
      worker.stats.earnings.push({
        date: new Date(),
        amount: workerPayment
      });
      
      await worker.save();
    }

    // Notify worker
    await Notification.create({
      type: 'job_completed',
      user: req.user.id,
      userModel: 'Worker',
      job: job._id,
      message: `You have completed the job for service: ${job.service}`
    });

    // Notify all admins
    const admins = await import('../models/Admin.js').then(mod => mod.default.find());
    await Promise.all(admins.map(a => Notification.create({
      type: 'job_completed',
      user: a._id,
      userModel: 'Admin',
      job: job._id,
      message: `Job completed by worker` 
    })));

    res.json({ message: 'Job completed', job });
  } catch (err) {
    res.status(500).json({ message: 'Failed to complete job', error: err.message });
  }
});

// WORKER: Start a job
router.post('/:id/start', workerAuth, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    if (job.assignedWorker.toString() !== req.user.id) return res.status(403).json({ message: 'Not authorized' });
    if (job.status !== 'Accepted') return res.status(400).json({ message: 'Job not in accepted state' });

    // Update job status
    job.status = 'In Progress';
    job.startedAt = new Date();
    await job.save();

    // Notify worker
    await Notification.create({
      type: 'job_started',
      user: req.user.id,
      userModel: 'Worker',
      job: job._id,
      message: `You have started the job for service: ${job.service}`
    });

    // Notify all admins
    const admins = await import('../models/Admin.js').then(mod => mod.default.find());
    await Promise.all(admins.map(a => Notification.create({
      type: 'job_started',
      user: a._id,
      userModel: 'Admin',
      job: job._id,
      message: `Job started by worker` 
    })));

    res.json({ message: 'Job started', job });
  } catch (err) {
    res.status(500).json({ message: 'Failed to start job', error: err.message });
  }
});

// WORKER: Cancel a job
router.post('/:id/cancel', workerAuth, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    if (job.assignedWorker.toString() !== req.user.id) return res.status(403).json({ message: 'Not authorized' });
    if (!['Accepted', 'In Progress'].includes(job.status)) return res.status(400).json({ message: 'Job cannot be cancelled in current state' });

    // Update job status
    job.status = 'Cancelled';
    await job.save();

    // Notify worker
    await Notification.create({
      type: 'job_cancelled',
      user: req.user.id,
      userModel: 'Worker',
      job: job._id,
      message: `You have cancelled the job for service: ${job.service}`
    });

    // Notify all admins
    const admins = await import('../models/Admin.js').then(mod => mod.default.find());
    await Promise.all(admins.map(a => Notification.create({
      type: 'job_cancelled',
      user: a._id,
      userModel: 'Admin',
      job: job._id,
      message: `Job cancelled by worker` 
    })));

    res.json({ message: 'Job cancelled', job });
  } catch (err) {
    res.status(500).json({ message: 'Failed to cancel job', error: err.message });
  }
});

// ADMIN: Get all jobs with details
router.get('/all', adminAuth, async (req, res) => {
  try {
    const jobs = await Job.find().populate('customer assignedWorker candidateWorkers rejectedBy booking');
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch jobs', error: err.message });
  }
});

// GET /api/jobs/:id - Get job details by ID (for worker, admin, or customer)
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (!id || id === 'undefined') {
    return res.status(400).json({ message: 'Job ID is required' });
  }
  try {
    const job = await Job.findById(id)
      .populate('customer assignedWorker candidateWorkers rejectedBy');
    if (!job) return res.status(404).json({ message: 'Job not found' });
    res.json(job);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch job details', error: err.message });
  }
});

export default router;

