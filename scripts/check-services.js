import mongoose from 'mongoose';
import ServicePrice from '../models/ServicePrice.js';
import dotenv from 'dotenv';

dotenv.config();

const checkServices = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    console.log('\n📋 Current plumber services:');
    const plumberServices = await ServicePrice.find({
      serviceType: 'plumber',
      isActive: true
    }).sort({ serviceTitle: 1 });
    
    plumberServices.forEach(service => {
      console.log(`  - ${service.serviceTitle}: ₹${service.price}`);
    });

    console.log('\n📋 Current electronics services:');
    const electronicsServices = await ServicePrice.find({
      serviceType: 'electronics',
      isActive: true
    }).sort({ serviceTitle: 1 });
    
    electronicsServices.forEach(service => {
      console.log(`  - ${service.serviceTitle}: ₹${service.price}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
};

checkServices();
