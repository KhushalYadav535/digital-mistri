import mongoose from 'mongoose';

const BookingSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  serviceType: { type: String, required: true },
  serviceTitle: { type: String, required: true },
  address: { type: String, required: true },
  phone: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['Pending', 'Confirmed', 'Worker Assigned', 'Accepted', 'Rejected', 'In Progress', 'Completed', 'Cancelled'],
    default: 'Pending'
  },
  worker: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker' },
  assignedAt: { type: Date },
  acceptedAt: { type: Date },
  rejectedAt: { type: Date },
  startedAt: { type: Date },
  completedAt: { type: Date },
  cancelledAt: { type: Date },
  cancellationReason: { type: String },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Booking', BookingSchema);
