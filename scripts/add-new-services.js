import mongoose from 'mongoose';
import Service from '../models/Service.js';
import dotenv from 'dotenv';

dotenv.config();

const newServices = [
  {
    name: 'carpenter',
    description: 'Professional carpentry and woodwork services',
    rate: 0,
    category: 'Carpentry',
    isActive: false, // Coming soon
  },
  {
    name: 'cleaner',
    description: 'Professional cleaning and maintenance services',
    rate: 0,
    category: 'Cleaning',
    isActive: false, // Coming soon
  },
  {
    name: 'mechanic',
    description: 'Professional automotive repair and maintenance',
    rate: 0,
    category: 'Automotive',
    isActive: false, // Coming soon
  },
  {
    name: 'welder',
    description: 'Professional welding and metal fabrication services',
    rate: 0,
    category: 'Welding',
    isActive: false, // Coming soon
  },
  {
    name: 'tailor',
    description: 'Professional tailoring and garment services',
    rate: 0,
    category: 'Tailoring',
    isActive: false, // Coming soon
  },
];

const addNewServices = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    for (const serviceData of newServices) {
      // Check if service already exists
      const existingService = await Service.findOne({ name: serviceData.name });
      
      if (existingService) {
        console.log(`Service '${serviceData.name}' already exists, skipping...`);
        continue;
      }

      // Create new service
      const service = new Service(serviceData);
      await service.save();
      console.log(`Service '${serviceData.name}' added successfully`);
    }

    console.log('All new services processed successfully');
  } catch (error) {
    console.error('Error adding services:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

addNewServices(); 