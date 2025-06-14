import mongoose from 'mongoose';
import Worker from '../models/Worker.js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI;

async function createWorker() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Check if worker exists
    let worker = await Worker.findOne({ email: 'test@gmail.com' });
    
    if (worker) {
      // Update existing worker
      worker.services = ['plumber'];
      worker.isVerified = true;
      worker.isAvailable = true;
      await worker.save();
      console.log('Worker updated:', worker);
    } else {
      // Create new worker
      const hashedPassword = await bcrypt.hash('9005754137', 10);
      worker = new Worker({
        name: 'Test',
        email: 'test@gmail.com',
        phone: '9005754137',
        password: hashedPassword,
        isVerified: true,
        isAvailable: true,
        services: ['plumber'],
        stats: {
          totalBookings: 0,
          completedBookings: 0,
          totalEarnings: 0
        }
      });
      await worker.save();
      console.log('Worker created:', worker);
    }

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

createWorker(); 