import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Job from '../models/Job.js';

const dbName = 'digital-mistri-dev';
const MONGODB_URI = `mongodb://localhost:27017/${dbName}`;

const statusMap = {
  'pending': 'Pending',
  'accepted': 'Accepted',
  'in_progress': 'In Progress',
  'rejected': 'Rejected',
  'completed': 'Completed',
  'cancelled': 'Cancelled',
  'worker assigned': 'Worker Assigned',
  'confirmed': 'Confirmed',
  'rejected': 'Rejected',
  'in progress': 'In Progress',
  'cancelled': 'Cancelled',
};

async function fixStatuses() {
  await mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    family: 4
  });
  console.log('Connected to MongoDB');

  // Fix Bookings
  const bookings = await Booking.find();
  for (const booking of bookings) {
    const orig = booking.status;
    const fixed = statusMap[(booking.status || '').toLowerCase()];
    if (fixed && fixed !== orig) {
      booking.status = fixed;
      await booking.save();
      console.log(`Booking ${booking._id}: ${orig} => ${fixed}`);
    }
  }

  // Fix Jobs
  const jobs = await Job.find();
  for (const job of jobs) {
    const orig = job.status;
    const fixed = statusMap[(job.status || '').toLowerCase()];
    if (fixed && fixed !== orig) {
      job.status = fixed;
      await job.save();
      console.log(`Job ${job._id}: ${orig} => ${fixed}`);
    }
  }

  await mongoose.disconnect();
  console.log('Migration complete.');
}

fixStatuses(); 