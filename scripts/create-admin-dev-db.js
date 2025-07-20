import mongoose from 'mongoose';
import Admin from '../models/Admin.js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const createAdminDevDB = async () => {
  try {
    // Use the same logic as the backend to determine the database
    const dbName = process.env.NODE_ENV === 'development' 
      ? 'digital-mistri-dev' 
      : 'digital-mistri';

    // Construct MongoDB URI with database name (same as backend)
    const baseURI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    const MONGODB_URI = baseURI.endsWith(dbName) ? baseURI : `${baseURI.replace(/\/$/, '')}/${dbName}`;
    
    console.log('🔗 Connecting to MongoDB...');
    console.log('Database:', dbName);
    console.log('URI:', MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')); // Hide credentials
    
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Get database info
    const db = mongoose.connection.db;
    const actualDbName = db.databaseName;
    console.log('📊 Actual database name:', actualDbName);
    
    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email: 'digitalmistri33@gmail.com' });
    
    if (existingAdmin) {
      console.log('✅ Admin already exists, updating password...');
      
      // Update password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash('Sunita@2030', saltRounds);
      existingAdmin.password = hashedPassword;
      await existingAdmin.save();
      
      console.log('✅ Admin password updated successfully');
    } else {
      console.log('📝 Creating new admin account...');
      
      // Hash the password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash('Sunita@2030', saltRounds);

      // Create new admin
      const admin = new Admin({
        email: 'digitalmistri33@gmail.com',
        password: hashedPassword,
        name: 'Digital Mistri Admin',
        role: 'admin'
      });

      await admin.save();
      console.log('✅ Admin account created successfully');
    }
    
    // Verify the admin exists
    const verifyAdmin = await Admin.findOne({ email: 'digitalmistri33@gmail.com' });
    if (verifyAdmin) {
      console.log('\n✅ Admin verification successful:');
      console.log('ID:', verifyAdmin._id);
      console.log('Email:', verifyAdmin.email);
      console.log('Name:', verifyAdmin.name);
      console.log('Role:', verifyAdmin.role);
      
      // Test password
      const isMatch = await bcrypt.compare('Sunita@2030', verifyAdmin.password);
      console.log('🔐 Password test: "Sunita@2030" matches:', isMatch);
    }
    
    console.log('\n🎉 Admin account ready for login!');
    console.log('Email: digitalmistri33@gmail.com');
    console.log('Password: Sunita@2030');

  } catch (error) {
    console.error('❌ Error with admin account:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
};

createAdminDevDB(); 