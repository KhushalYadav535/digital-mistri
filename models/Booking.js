import mongoose from 'mongoose';

const BookingSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  serviceType: { type: String, required: true }, // plumber, electrician, etc.
  serviceTitle: { type: String, required: true }, // e.g. Basin Set Fitting/Repair
  address: { type: String, required: true },
  phone: { type: String, required: true },
  status: { type: String, default: 'Pending' }, // Pending, Confirmed, Worker Assigned, Accepted, Completed, Cancelled
  worker: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker' },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Booking', BookingSchema);
