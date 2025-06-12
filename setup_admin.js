import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import Admin from './models/Admin.js';

const MONGODB_URI = 'mongodb+srv://****:****@cluster0.imugfvo.mongodb.net/digital-mistri';

async function setupAdmin() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const email = 'digitalmistri33@gmail.com';
    const password = 'Anubhav@2025';
    const name = 'Admin';

    // Delete existing admin if any
    await Admin.deleteOne({ email });
    console.log('Deleted existing admin if any');

    // Create new admin
    const hashed = await bcrypt.hash(password, 10);
    const admin = new Admin({
      name,
      email,
      password: hashed,
      role: 'admin'
    });
    await admin.save();
    console.log('Admin created successfully');

    // Verify
    const verifyAdmin = await Admin.findOne({ email });
    console.log('Verification:', {
      exists: !!verifyAdmin,
      id: verifyAdmin?._id,
      name: verifyAdmin?.name,
      email: verifyAdmin?.email,
      role: verifyAdmin?.role
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

setupAdmin(); 