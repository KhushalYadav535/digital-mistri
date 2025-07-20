import mongoose from 'mongoose';
import ServicePrice from '../models/ServicePrice.js';
import dotenv from 'dotenv';

dotenv.config();

// Default service prices from serviceMeta
const defaultServicePrices = [
  // Plumber services
  { serviceType: 'plumber', serviceTitle: 'Basin Set Fitting/Repair', price: 200 },
  { serviceType: 'plumber', serviceTitle: 'Flush Tank Service', price: 300 },
  { serviceType: 'plumber', serviceTitle: 'Wiring Related Repair', price: 250 },
  { serviceType: 'plumber', serviceTitle: 'Toti Installation', price: 50 },
  
  // Electrician services
  { serviceType: 'electrician', serviceTitle: 'Switchbox Installation', price: 150 },
  { serviceType: 'electrician', serviceTitle: 'AC Switchbox Installation', price: 250 },
  { serviceType: 'electrician', serviceTitle: 'Wifi Smart Switch Installation', price: 300 },
  { serviceType: 'electrician', serviceTitle: 'Switchboard/Switch Repair', price: 50 },
  { serviceType: 'electrician', serviceTitle: 'Fan Installation/Uninstallation', price: 100 },
  { serviceType: 'electrician', serviceTitle: 'Fan Regulator Repair/Replacement', price: 100 },
  { serviceType: 'electrician', serviceTitle: 'Tubelight/Bulb Holder Installation', price: 100 },
  { serviceType: 'electrician', serviceTitle: 'Single-pole MCB Installation', price: 150 },
  { serviceType: 'electrician', serviceTitle: 'Double-pole MCB Installation', price: 200 },
  { serviceType: 'electrician', serviceTitle: 'MCB/Fuse Replacement', price: 200 },
  { serviceType: 'electrician', serviceTitle: 'Submeter Installation', price: 200 },
  { serviceType: 'electrician', serviceTitle: 'Inverter Installation/Uninstallation', price: 300 },
  { serviceType: 'electrician', serviceTitle: 'Stabilizer Installation/Uninstallation', price: 200 },
  
  // Electronics services
  { serviceType: 'electronics', serviceTitle: 'Solar Panel Installation', price: 250 },
  { serviceType: 'electronics', serviceTitle: 'TV Installation/Uninstallation', price: 300 },
  { serviceType: 'electronics', serviceTitle: 'Fridge Service', price: 300 },
  { serviceType: 'electronics', serviceTitle: 'Fridge Gas Changing', price: 1500 },
  { serviceType: 'electronics', serviceTitle: 'AC Installation', price: 1500 },
  { serviceType: 'electronics', serviceTitle: 'AC Service', price: 600 },
  { serviceType: 'electronics', serviceTitle: 'Gas Geyser', price: 300 },
  { serviceType: 'electronics', serviceTitle: 'Washing Machine', price: 500 },
  { serviceType: 'electronics', serviceTitle: 'RO Service', price: 400 },
  { serviceType: 'electronics', serviceTitle: 'AC Gas Changing', price: 3500 },
  
  // Handpump services
  { serviceType: 'handpump', serviceTitle: 'Dhol Fitting (6 No.)', price: 200 },
  { serviceType: 'handpump', serviceTitle: 'Chakbal Fitting (6 No.)', price: 200 },
  { serviceType: 'handpump', serviceTitle: 'Section Fitting (6 No.)', price: 400 },
  { serviceType: 'handpump', serviceTitle: 'New Tullu Fitting (6 No.)', price: 400 },
  { serviceType: 'handpump', serviceTitle: 'Chakri Setting (6 No.)', price: 400 },
  { serviceType: 'handpump', serviceTitle: '1.25 inch Coupling Fitting (6 No.)', price: 400 },
  { serviceType: 'handpump', serviceTitle: 'India Mark 2 Chain Fitting', price: 300 },
  { serviceType: 'handpump', serviceTitle: 'Bearing Fitting', price: 300 },
  { serviceType: 'handpump', serviceTitle: 'Dhura Fitting', price: 300 },
  { serviceType: 'handpump', serviceTitle: 'Packing Fitting', price: 300 },
];

const initializeServicePrices = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Create a mock admin ID for the updatedBy field
    const mockAdminId = new mongoose.Types.ObjectId();

    for (const servicePriceData of defaultServicePrices) {
      // Check if service price already exists
      const existingServicePrice = await ServicePrice.findOne({
        serviceType: servicePriceData.serviceType,
        serviceTitle: servicePriceData.serviceTitle
      });
      
      if (existingServicePrice) {
        console.log(`Service price for '${servicePriceData.serviceTitle}' already exists, skipping...`);
        continue;
      }

      // Create new service price
      const servicePrice = new ServicePrice({
        ...servicePriceData,
        updatedBy: mockAdminId,
        isActive: true
      });
      await servicePrice.save();
      console.log(`Service price for '${servicePriceData.serviceTitle}' added successfully`);
    }

    console.log('All service prices initialized successfully');
  } catch (error) {
    console.error('Error initializing service prices:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

initializeServicePrices(); 