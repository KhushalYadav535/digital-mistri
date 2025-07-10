import mongoose from 'mongoose';

const SupportSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'resolved'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  resolvedAt: {
    type: Date
  }
});

// Add index for faster queries
SupportSchema.index({ customer: 1, createdAt: -1 });
SupportSchema.index({ status: 1 });

export default mongoose.model('Support', SupportSchema); 