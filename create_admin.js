import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import Admin from './models/Admin.js';

dotenv.config();

// Use the same MongoDB URI that's working in the main server
const MONGODB_URI = 'mongodb+srv://****:****@cluster0.imugfvo.mongodb.net/digital-mistri';

if (!MONGODB_URI) {
  console.error('MONGODB_URI is not set');
  process.exit(1);
}

async function createAdmin() {
  try {
    console.log('Connecting to MongoDB...');
    console.log('MongoDB URI:', MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//****:****@'));
    
    await mongoose.connect(MONGODB_URI, { 
      useNewUrlParser: true, 
      useUnifiedTopology: true 
    });
    
    console.log('Connected to MongoDB');
    console.log('MongoDB Connection State:', mongoose.connection.readyState);

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
      const admin = new Admin({ 
        name, 
        email, 
        password: hashed,
        role: 'admin'
      });
      await admin.save();
      console.log('Admin created successfully:', email);
    }

    // Verify the admin was created/updated
    const verifyAdmin = await Admin.findOne({ email });
    console.log('Verification - Admin exists:', !!verifyAdmin);
    if (verifyAdmin) {
      console.log('Admin details:', {
        id: verifyAdmin._id,
        name: verifyAdmin.name,
        email: verifyAdmin.email,
        role: verifyAdmin.role
      });
    }

  } catch (error) {
    console.error('Error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB disconnected');
    process.exit(0);
  }
}

createAdmin();
