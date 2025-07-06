import mongoose from 'mongoose';

const CustomerSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters long']
  },
  email: { 
    type: String, 
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email address']
  },
  phone: { 
    type: String, 
    required: [true, 'Phone number is required'],
    trim: true,
    match: [/^[0-9]{10}$/, 'Please enter a valid 10-digit phone number']
  },
  password: { 
    type: String, 
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long']
  },
  address: {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    pincode: { type: String, trim: true }
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  lastLogin: {
    type: Date
  },
  resetPasswordOTP: {
    type: String
  },
  resetPasswordExpires: {
    type: Date
  }
});

// Add index for faster queries
CustomerSchema.index({ email: 1 });
CustomerSchema.index({ phone: 1 });

// Pre-save middleware to trim strings
CustomerSchema.pre('save', function(next) {
  if (this.name) this.name = this.name.trim();
  if (this.email) this.email = this.email.trim().toLowerCase();
  if (this.phone) this.phone = this.phone.trim();
  if (this.address) {
    if (this.address.street) this.address.street = this.address.street.trim();
    if (this.address.city) this.address.city = this.address.city.trim();
    if (this.address.state) this.address.state = this.address.state.trim();
    if (this.address.pincode) this.address.pincode = this.address.pincode.trim();
  }
  next();
});

// Error handling middleware
CustomerSchema.post('save', function(error, doc, next) {
  if (error.name === 'MongoError' && error.code === 11000) {
    next(new Error('Email already exists'));
  } else {
    next(error);
  }
});

export default mongoose.model('Customer', CustomerSchema);
