import mongoose from 'mongoose';
import Admin from '../models/Admin.js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const createAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email: 'digitalmistri33@gmail.com' });
    
    if (existingAdmin) {
      console.log('Admin with email digitalmistri33@gmail.com already exists');
      return;
    }

    // Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash('Sunita@2030', saltRounds);

    // Create new admin
    const admin = new Admin({
      email: 'digitalmistri33@gmail.com',
      password: hashedPassword,
      name: 'Digital Mistri Admin',
      isVerified: true,
      role: 'admin'
    });

    await admin.save();
    console.log('Admin account created successfully');
    console.log('Email: digitalmistri33@gmail.com');
    console.log('Password: Sunita@2030');

  } catch (error) {
    console.error('Error creating admin:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

createAdmin(); 