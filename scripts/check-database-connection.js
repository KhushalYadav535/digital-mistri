import mongoose from 'mongoose';
import Admin from '../models/Admin.js';
import dotenv from 'dotenv';

dotenv.config();

const checkDatabaseConnection = async () => {
  try {
    // Connect to MongoDB using the same connection string as the backend
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('MONGODB_URI not found in environment variables');
      return;
    }
    
    console.log('🔗 Connecting to MongoDB...');
    console.log('URI:', mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')); // Hide credentials
    
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
    
    // Get database info
    const db = mongoose.connection.db;
    const dbName = db.databaseName;
    console.log('📊 Database name:', dbName);
    
    // List all collections
    const collections = await db.listCollections().toArray();
    console.log('📁 Collections:', collections.map(c => c.name));
    
    // Check admin collection specifically
    const adminCollection = db.collection('admins');
    const adminCount = await adminCollection.countDocuments();
    console.log('👥 Total admins in collection:', adminCount);
    
    // Find all admins
    const allAdmins = await adminCollection.find({}).toArray();
    console.log('📋 All admins:');
    allAdmins.forEach((admin, index) => {
      console.log(`${index + 1}. ${admin.email} (${admin.name})`);
    });
    
    // Check specific admin
    const targetAdmin = await adminCollection.findOne({ email: 'digitalmistri33@gmail.com' });
    if (targetAdmin) {
      console.log('\n✅ Target admin found in database:');
      console.log('ID:', targetAdmin._id);
      console.log('Email:', targetAdmin.email);
      console.log('Name:', targetAdmin.name);
      console.log('Role:', targetAdmin.role);
    } else {
      console.log('\n❌ Target admin NOT found in database');
    }
    
    // Also check using Mongoose model
    console.log('\n🔍 Checking with Mongoose model...');
    const mongooseAdmin = await Admin.findOne({ email: 'digitalmistri33@gmail.com' });
    if (mongooseAdmin) {
      console.log('✅ Admin found via Mongoose model');
    } else {
      console.log('❌ Admin NOT found via Mongoose model');
    }

  } catch (error) {
    console.error('❌ Error checking database:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
};

checkDatabaseConnection(); 