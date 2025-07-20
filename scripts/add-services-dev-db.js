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

const addServicesDevDB = async () => {
  try {
    // Use the same logic as the backend to determine the database
    const dbName = process.env.NODE_ENV === 'development' 
      ? 'digital-mistri-dev' 
      : 'digital-mistri';

    // Construct MongoDB URI with database name (same as backend)
    const baseURI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    const MONGODB_URI = baseURI.endsWith(dbName) ? baseURI : `${baseURI.replace(/\/$/, '')}/${dbName}`;
    
    console.log('🔗 Connecting to MongoDB...');
    console.log('Database:', dbName);
    console.log('URI:', MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')); // Hide credentials
    
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Get database info
    const db = mongoose.connection.db;
    const actualDbName = db.databaseName;
    console.log('📊 Actual database name:', actualDbName);

    for (const serviceData of newServices) {
      // Check if service already exists
      const existingService = await Service.findOne({ name: serviceData.name });
      
      if (existingService) {
        console.log(`⏭️  Service '${serviceData.name}' already exists, skipping...`);
        continue;
      }

      // Create new service
      const service = new Service(serviceData);
      await service.save();
      console.log(`✅ Service '${serviceData.name}' added successfully`);
    }

    console.log('\n🎉 All new services processed successfully!');
    console.log('📋 Services added: Carpenter, Cleaner, Mechanic, Welder, Tailor');
    console.log('📊 All services are set to "Coming Soon" status');

  } catch (error) {
    console.error('❌ Error adding services:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
};

addServicesDevDB(); 