import mongoose from 'mongoose';
import Admin from '../models/Admin.js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const updateAdminPassword = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find the admin
    const admin = await Admin.findOne({ email: 'digitalmistri33@gmail.com' });
    
    if (!admin) {
      console.log('Admin with email digitalmistri33@gmail.com not found');
      return;
    }

    // Hash the new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash('Sunita@2030', saltRounds);

    // Update the password
    admin.password = hashedPassword;
    await admin.save();
    
    console.log('Admin password updated successfully');
    console.log('Email: digitalmistri33@gmail.com');
    console.log('New Password: Sunita@2030');

  } catch (error) {
    console.error('Error updating admin password:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

updateAdminPassword(); 