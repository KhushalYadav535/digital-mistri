import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema({
  type: { type: String, required: true }, // e.g. job_assigned, job_accepted, job_rejected
  user: { type: mongoose.Schema.Types.ObjectId, refPath: 'userModel', required: true }, // Can be Worker, Admin, or Customer
  userModel: { type: String, required: true, enum: ['Worker', 'Admin', 'Customer'] },
  message: { type: String, required: true },
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Notification', NotificationSchema);
