import mongoose from 'mongoose';

const PendingShopSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  shopData: { type: Object, required: true },
  amount: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('PendingShop', PendingShopSchema); 