import mongoose from 'mongoose';
import Admin from '../models/Admin.js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const createAdminAtlas = async () => {
  try {
    // Connect to MongoDB Atlas (cloud database)
    const atlasUri = process.env.MONGODB_URI || process.env.MONGODB_ATLAS_URI;
    if (!atlasUri) {
      console.error('MongoDB Atlas URI not found in environment variables');
      return;
    }
    
    await mongoose.connect(atlasUri);
    console.log('Connected to MongoDB Atlas');

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email: 'digitalmistri33@gmail.com' });
    
    if (existingAdmin) {
      console.log('Admin with email digitalmistri33@gmail.com already exists in Atlas');
      console.log('Updating password...');
      
      // Update password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash('Sunita@2030', saltRounds);
      existingAdmin.password = hashedPassword;
      await existingAdmin.save();
      
      console.log('Admin password updated successfully in Atlas');
    } else {
      console.log('Creating new admin account in Atlas...');
      
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
      console.log('Admin account created successfully in Atlas');
    }
    
    console.log('✅ Admin Account Details:');
    console.log('Email: digitalmistri33@gmail.com');
    console.log('Password: Sunita@2030');

  } catch (error) {
    console.error('Error with admin account:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB Atlas');
  }
};

createAdminAtlas(); 