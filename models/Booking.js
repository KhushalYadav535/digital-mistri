import mongoose from 'mongoose';

const AddressSchema = new mongoose.Schema({
  street: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  pincode: { type: String, required: true }
});

const BookingSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  serviceType: { type: String, required: true },
  serviceTitle: { type: String, required: true },
  bookingDate: { type: Date, required: true },
  bookingTime: { type: String, required: true },
  address: { type: AddressSchema, required: true },
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
  // OTP for completion verification
  completionOtp: { type: String },
  completionOtpExpires: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Booking', BookingSchema);
