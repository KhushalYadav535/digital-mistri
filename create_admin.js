import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import Admin from './models/Admin.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

async function createAdmin() {
  await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  const email = 'digitalmistri33@gmail.com';
  const password = 'Anubhav@2025';
  const name = 'Admin';

  const exists = await Admin.findOne({ email });
  if (exists) {
    console.log('Admin already exists');
    process.exit(0);
  }
  const hashed = await bcrypt.hash(password, 10);
  const admin = new Admin({ name, email, password: hashed });
  await admin.save();
  console.log('Admin created:', email);
  process.exit(0);
}

createAdmin();
