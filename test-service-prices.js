import mongoose from 'mongoose';
import ServicePrice from './models/ServicePrice.js';
import dotenv from 'dotenv';

dotenv.config();

const testServicePrices = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Test 1: Check if service prices exist
    const allPrices = await ServicePrice.find();
    console.log(`\n📊 Total service prices in database: ${allPrices.length}`);

    // Test 2: Check specific service prices
    const plumberPrices = await ServicePrice.find({ serviceType: 'plumber' });
    console.log(`\n🔧 Plumber services: ${plumberPrices.length}`);
    plumberPrices.forEach(price => {
      console.log(`  - ${price.serviceTitle}: ₹${price.price}`);
    });

    const electricianPrices = await ServicePrice.find({ serviceType: 'electrician' });
    console.log(`\n⚡ Electrician services: ${electricianPrices.length}`);
    electricianPrices.forEach(price => {
      console.log(`  - ${price.serviceTitle}: ₹${price.price}`);
    });

    // Test 3: Check active vs inactive services
    const activePrices = await ServicePrice.find({ isActive: true });
    const inactivePrices = await ServicePrice.find({ isActive: false });
    console.log(`\n✅ Active services: ${activePrices.length}`);
    console.log(`❌ Inactive services: ${inactivePrices.length}`);

    // Test 4: Update a price to test the system
    const testService = await ServicePrice.findOne({ serviceType: 'plumber', serviceTitle: 'Basin Set Fitting/Repair' });
    if (testService) {
      const originalPrice = testService.price;
      const newPrice = originalPrice + 50;
      
      console.log(`\n🧪 Testing price update:`);
      console.log(`  Original price: ₹${originalPrice}`);
      console.log(`  New price: ₹${newPrice}`);
      
      testService.price = newPrice;
      await testService.save();
      console.log(`  ✅ Price updated successfully`);
      
      // Verify the update
      const updatedService = await ServicePrice.findOne({ serviceType: 'plumber', serviceTitle: 'Basin Set Fitting/Repair' });
      console.log(`  Verified price: ₹${updatedService.price}`);
      
      // Revert the price
      testService.price = originalPrice;
      await testService.save();
      console.log(`  🔄 Price reverted to original`);
    }

    console.log('\n🎉 All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
};

testServicePrices(); 