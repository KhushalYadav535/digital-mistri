import mongoose from 'mongoose';
import ServicePrice from './models/ServicePrice.js';
import dotenv from 'dotenv';

dotenv.config();

const testUpdatePrice = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find the specific service
    const service = await ServicePrice.findOne({
      serviceType: 'plumber',
      serviceTitle: 'Basin Set Fitting/Repair'
    });

    if (!service) {
      console.log('❌ Service not found');
      return;
    }

    console.log(`\n🔍 Current service details:`);
    console.log(`  Service Type: ${service.serviceType}`);
    console.log(`  Service Title: ${service.serviceTitle}`);
    console.log(`  Current Price: ₹${service.price}`);
    console.log(`  Is Active: ${service.isActive}`);

    // Update the price to 300
    const newPrice = 300;
    service.price = newPrice;
    service.updatedAt = new Date();
    
    await service.save();
    
    console.log(`\n✅ Price updated to ₹${newPrice}`);

    // Verify the update
    const updatedService = await ServicePrice.findOne({
      serviceType: 'plumber',
      serviceTitle: 'Basin Set Fitting/Repair'
    });

    console.log(`\n🔍 Verification:`);
    console.log(`  Updated Price: ₹${updatedService.price}`);
    console.log(`  Updated At: ${updatedService.updatedAt}`);

    // Test the public API endpoint
    console.log(`\n🌐 Testing public API endpoint...`);
    
    // Simulate what the frontend would do
    const allPrices = await ServicePrice.find({ isActive: true });
    const plumberPrices = allPrices.filter(sp => sp.serviceType === 'plumber');
    
    console.log(`\n📊 All active plumber services:`);
    plumberPrices.forEach(sp => {
      console.log(`  - ${sp.serviceTitle}: ₹${sp.price}`);
    });

    console.log('\n🎉 Price update test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
};

testUpdatePrice(); 