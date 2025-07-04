import mongoose from 'mongoose';

const JobSchema = new mongoose.Schema({
  service: { type: String, required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  assignedWorker: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker' },
  candidateWorkers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Worker' }],
  status: { type: String, enum: ['pending', 'accepted', 'in_progress', 'rejected', 'completed', 'cancelled'], default: 'pending' },
  requestedAt: { type: Date, default: Date.now },
  acceptedAt: { type: Date },
  startedAt: { type: Date },
  completedAt: { type: Date },
  rejectedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Worker' }],
  details: { type: Object }, // Extra info (address, time, etc)
}, { timestamps: true });

export default mongoose.model('Job', JobSchema);
