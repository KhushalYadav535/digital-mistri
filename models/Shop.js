import mongoose from 'mongoose';

const ShopSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  address: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
  },
  owner: {
    type: String, // or mongoose.Schema.Types.ObjectId if you want to reference Admin
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  }
});

export default mongoose.model('Shop', ShopSchema);
