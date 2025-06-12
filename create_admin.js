import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import Admin from './models/Admin.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

async function createAdmin() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');

    const email = 'digitalmistri33@gmail.com';
    const password = 'Anubhav@2025';
    const name = 'Admin';

    console.log('Checking if admin exists...');
    const exists = await Admin.findOne({ email });
    if (exists) {
      console.log('Admin already exists with email:', email);
      // Update password if needed
      const isMatch = await bcrypt.compare(password, exists.password);
      if (!isMatch) {
        console.log('Updating admin password...');
        const hashed = await bcrypt.hash(password, 10);
        exists.password = hashed;
        await exists.save();
        console.log('Admin password updated successfully');
      } else {
        console.log('Admin password is correct');
      }
    } else {
      console.log('Creating new admin...');
      const hashed = await bcrypt.hash(password, 10);
      const admin = new Admin({ name, email, password: hashed });
      await admin.save();
      console.log('Admin created successfully:', email);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

createAdmin();
