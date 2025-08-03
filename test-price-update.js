import mongoose from 'mongoose';
import ServicePrice from './models/ServicePrice.js';
import dotenv from 'dotenv';

dotenv.config();

const testPriceUpdate = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check the current price for Basin Set Fitting/Repair
    const servicePrice = await ServicePrice.findOne({
      serviceType: 'plumber',
      serviceTitle: 'Basin Set Fitting/Repair'
    });

    if (servicePrice) {
      console.log('Current price for Basin Set Fitting/Repair:', servicePrice.price);
      console.log('Service details:', {
        serviceType: servicePrice.serviceType,
        serviceTitle: servicePrice.serviceTitle,
        price: servicePrice.price,
        isActive: servicePrice.isActive,
        updatedAt: servicePrice.updatedAt
      });
    } else {
      console.log('Service price not found for Basin Set Fitting/Repair');
    }

    // List all plumber services
    const plumberServices = await ServicePrice.find({ serviceType: 'plumber' });
    console.log('\nAll plumber services:');
    plumberServices.forEach(service => {
      console.log(`- ${service.serviceTitle}: ₹${service.price}`);
    });

  } catch (error) {
    console.error('Error testing price update:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

testPriceUpdate(); 