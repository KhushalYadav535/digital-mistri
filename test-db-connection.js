import mongoose from 'mongoose';

// Connect to MongoDB
const dbName = 'digital-mistri-dev';
const MONGODB_URI = `mongodb://localhost:27017/${dbName}`;

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  family: 4
});

async function testConnection() {
  try {
    console.log('Testing database connection...');
    
    // List all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Collections in database:', collections.map(c => c.name));
    
    // Check if we can connect to each collection
    for (const collection of collections) {
      const count = await mongoose.connection.db.collection(collection.name).countDocuments();
      console.log(`${collection.name}: ${count} documents`);
    }
    
  } catch (error) {
    console.error('Error testing database:', error);
  } finally {
    mongoose.disconnect();
  }
}

testConnection(); 