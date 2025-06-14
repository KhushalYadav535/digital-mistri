import mongoose from 'mongoose';

const workerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String },
  password: { type: String, required: true },
  isVerified: { type: Boolean, default: false },
  isAvailable: { type: Boolean, default: true },
  services: [{ type: String }],
  stats: {
    totalBookings: { type: Number, default: 0 },
    completedBookings: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 },
    earnings: [{
      date: { type: Date, default: Date.now },
      amount: { type: Number, default: 0 }
    }]
  }
});

export default mongoose.model('Worker', workerSchema);
