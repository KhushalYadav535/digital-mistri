import mongoose from 'mongoose';
import ServicePrice from '../models/ServicePrice.js';
import dotenv from 'dotenv';

dotenv.config();

const updateServices = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // 1. Remove "Toti Installation" from plumber services
    console.log('🗑️ Removing "Toti Installation" from plumber services...');
    const totiRemoval = await ServicePrice.deleteOne({
      serviceType: 'plumber',
      serviceTitle: 'Toti Installation'
    });
    
    if (totiRemoval.deletedCount > 0) {
      console.log('✅ "Toti Installation" removed successfully from plumber services');
    } else {
      console.log('ℹ️ "Toti Installation" was not found in plumber services');
    }

    // 2. Update "Fridge Gas Changing" price to 1200
    console.log('💰 Updating "Fridge Gas Changing" price to ₹1200...');
    const fridgeGasUpdate = await ServicePrice.updateOne(
      {
        serviceType: 'electronics',
        serviceTitle: 'Fridge Gas Changing'
      },
      {
        $set: { price: 1200 }
      }
    );
    
    if (fridgeGasUpdate.modifiedCount > 0) {
      console.log('✅ "Fridge Gas Changing" price updated to ₹1200 successfully');
    } else {
      console.log('ℹ️ "Fridge Gas Changing" was not found or price was already ₹1200');
    }

    // 3. Show current plumber services
    console.log('\n📋 Current plumber services:');
    const plumberServices = await ServicePrice.find({
      serviceType: 'plumber',
      isActive: true
    }).sort({ serviceTitle: 1 });
    
    plumberServices.forEach(service => {
      console.log(`  - ${service.serviceTitle}: ₹${service.price}`);
    });

    // 4. Show current electronics services
    console.log('\n📋 Current electronics services:');
    const electronicsServices = await ServicePrice.find({
      serviceType: 'electronics',
      isActive: true
    }).sort({ serviceTitle: 1 });
    
    electronicsServices.forEach(service => {
      console.log(`  - ${service.serviceTitle}: ₹${service.price}`);
    });

    console.log('\n🎉 Service updates completed successfully!');

  } catch (error) {
    console.error('❌ Error updating services:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

updateServices();
