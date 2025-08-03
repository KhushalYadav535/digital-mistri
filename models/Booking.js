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
  amount: { type: Number, required: true },
  // Distance calculation fields
  distance: { type: Number, default: 0 }, // Distance in kilometers
  distanceCharge: { type: Number, default: 0 }, // Distance charge in rupees
  totalAmount: { type: Number, required: true }, // Total amount including distance charge
  // Admin commission and worker payment fields
  adminCommission: { type: Number, default: 0 }, // 20% of service amount (not distance charge)
  workerPayment: { type: Number, default: 0 }, // Service amount after admin commission deduction
  customerCoordinates: {
    latitude: { type: Number },
    longitude: { type: Number },
    displayName: { type: String }, // Full address from geocoding
    accuracy: { type: Number } // Accuracy score (0-1)
  },
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
  // Review/rating fields
  rating: { type: Number, min: 1, max: 5 },
  review: { type: String },
  // Payment verification fields
  paymentVerified: { type: Boolean, default: false },
  paidAmount: { type: Number },
  paymentVerifiedAt: { type: Date },
  // Multiple services support
  parentBooking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' }, // Reference to parent booking for multiple services
  childBookings: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Booking' }], // Child bookings for multiple services
  isMultipleServiceBooking: { type: Boolean, default: false }, // Flag to identify multiple service bookings
  serviceBreakdown: [{ // Breakdown of services in this booking
    serviceType: { type: String, required: true },
    serviceTitle: { type: String, required: true },
    amount: { type: Number, required: true },
    quantity: { type: Number, default: 1 }
  }],
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Booking', BookingSchema);
