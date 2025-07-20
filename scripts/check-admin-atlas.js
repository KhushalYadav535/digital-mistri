import mongoose from 'mongoose';
import Admin from '../models/Admin.js';
import dotenv from 'dotenv';

dotenv.config();

const checkAdminAtlas = async () => {
  try {
    // Connect to MongoDB Atlas
    const atlasUri = process.env.MONGODB_URI || process.env.MONGODB_ATLAS_URI;
    if (!atlasUri) {
      console.error('MongoDB Atlas URI not found in environment variables');
      return;
    }
    
    await mongoose.connect(atlasUri);
    console.log('Connected to MongoDB Atlas');

    // Find all admins
    const admins = await Admin.find({});
    console.log(`\n📊 Total admins found: ${admins.length}`);
    
    if (admins.length === 0) {
      console.log('❌ No admin accounts found in Atlas');
      return;
    }

    // Check specific admin
    const targetAdmin = await Admin.findOne({ email: 'digitalmistri33@gmail.com' });
    
    if (targetAdmin) {
      console.log('\n✅ Target admin found:');
      console.log('ID:', targetAdmin._id);
      console.log('Name:', targetAdmin.name);
      console.log('Email:', targetAdmin.email);
      console.log('Role:', targetAdmin.role);
      console.log('Password hash exists:', !!targetAdmin.password);
      console.log('Password length:', targetAdmin.password?.length || 0);
    } else {
      console.log('\n❌ Target admin NOT found');
      console.log('Available admins:');
      admins.forEach((admin, index) => {
        console.log(`${index + 1}. ${admin.email} (${admin.name})`);
      });
    }

    // Test password verification
    if (targetAdmin) {
      const bcrypt = await import('bcryptjs');
      const isMatch = await bcrypt.default.compare('Sunita@2030', targetAdmin.password);
      console.log('\n🔐 Password test:');
      console.log('Password "Sunita@2030" matches:', isMatch);
    }

  } catch (error) {
    console.error('Error checking admin in Atlas:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB Atlas');
  }
};

checkAdminAtlas(); 