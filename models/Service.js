import mongoose from 'mongoose';

const ServiceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
    default: '',
  },
  rate: {
    type: Number,
    required: true,
  },
  category: {
    type: String,
    default: 'General',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model('Service', ServiceSchema);
