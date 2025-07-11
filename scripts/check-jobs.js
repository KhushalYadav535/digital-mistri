import mongoose from 'mongoose';
import Job from '../models/Job.js';
import Customer from '../models/Customer.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/digital';

async function main() {
  await mongoose.connect(MONGO_URI);
  const jobs = await Job.find().populate('customer assignedWorker booking');
  if (!jobs.length) {
    console.log('No jobs found in database.');
  } else {
    jobs.forEach(job => {
      console.log(`Job: ${job._id}\n  Service: ${job.service}\n  Customer: ${job.customer?.name || job.customer}\n  Status: ${job.status}\n  Assigned Worker: ${job.assignedWorker ? job.assignedWorker.name + ' (' + job.assignedWorker._id + ')' : '-'}\n  Booking: ${job.booking?._id || '-'}\n`);
    });
  }
  await mongoose.disconnect();
}

main(); 