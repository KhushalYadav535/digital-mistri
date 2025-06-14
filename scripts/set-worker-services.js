// Script to update a worker's services array by email
import mongoose from 'mongoose';
import Worker from '../models/Worker.js';

const MONGO_URI = 'mongodb://localhost:27017/digital-mistri'; // <-- Change this if your DB is hosted elsewhere

async function updateWorkerServices(email, services) {
  await mongoose.connect(MONGO_URI);
  const result = await Worker.findOneAndUpdate(
    { email },
    { $set: { services } },
    { new: true }
  );
  if (result) {
    console.log('Updated worker:', result);
  } else {
    console.log('Worker not found');
  }
  await mongoose.disconnect();
}

// CHANGE THESE VALUES AS NEEDED
const email = 'test@gmail.com';
const services = ['plumber'];

updateWorkerServices(email, services).catch(console.error);
