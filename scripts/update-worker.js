import mongoose from 'mongoose';
import Worker from '../models/Worker.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI;

async function updateWorker() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Update worker with email test@gmail.com
    const worker = await Worker.findOneAndUpdate(
      { email: 'test@gmail.com' },
      { 
        $set: { 
          services: ['plumber'],
          isVerified: true,
          isAvailable: true
        }
      },
      { new: true }
    );

    if (worker) {
      console.log('Worker updated successfully:', worker);
    } else {
      console.log('Worker not found');
    }

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

updateWorker(); 