import mongoose from 'mongoose';

const ServicePriceSchema = new mongoose.Schema({
  serviceType: {
    type: String,
    required: true,
  },
  serviceTitle: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Create a compound index to ensure unique service type + title combinations
ServicePriceSchema.index({ serviceType: 1, serviceTitle: 1 }, { unique: true });

export default mongoose.model('ServicePrice', ServicePriceSchema); 