import mongoose from 'mongoose';

const CustomerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  password: { type: String, required: true },
  address: { type: String },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('Customer', CustomerSchema);
