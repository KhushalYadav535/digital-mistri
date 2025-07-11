import mongoose from 'mongoose';
import Job from '../models/Job.js';
import Booking from '../models/Booking.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/digital';

async function main() {
  await mongoose.connect(MONGO_URI);
  const jobs = await Job.find({ $or: [ { assignedWorker: { $exists: false } }, { assignedWorker: null } ] }).populate('booking');
  let updated = 0;
  for (const job of jobs) {
    if (job.booking && (job.booking.assignedWorker || job.booking.worker)) {
      job.assignedWorker = job.booking.assignedWorker || job.booking.worker;
      await job.save();
      updated++;
      console.log(`Updated job ${job._id} with assignedWorker ${job.assignedWorker}`);
    }
  }
  console.log(`Total jobs updated: ${updated}`);
  await mongoose.disconnect();
}

main(); 