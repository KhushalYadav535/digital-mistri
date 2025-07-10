import mongoose from 'mongoose';
import Worker from './models/Worker.js';
import Booking from './models/Booking.js';

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

async function testWorkerStats() {
  try {
    console.log('Testing worker statistics...');
    
    // Find a worker
    const worker = await Worker.findOne();
    if (!worker) {
      console.log('No worker found in database');
      return;
    }
    
    console.log('Worker found:', worker.name);
    console.log('Current stats:', worker.stats);
    
    // Get all bookings for this worker
    const allWorkerBookings = await Booking.find({ worker: worker._id });
    console.log('Total bookings for worker:', allWorkerBookings.length);
    
    // Calculate statistics
    const totalBookings = allWorkerBookings.length;
    const completedBookings = allWorkerBookings.filter(booking => 
      booking.status === 'Completed'
    ).length;
    
    const totalEarnings = allWorkerBookings
      .filter(booking => booking.status === 'Completed')
      .reduce((sum, booking) => sum + (booking.amount || 0), 0);
    
    console.log('Calculated stats:');
    console.log('- Total bookings:', totalBookings);
    console.log('- Completed bookings:', completedBookings);
    console.log('- Total earnings:', totalEarnings);
    
    // Show some booking details
    console.log('\nBooking details:');
    allWorkerBookings.forEach((booking, index) => {
      console.log(`${index + 1}. ID: ${booking._id}, Status: ${booking.status}, Amount: ${booking.amount}`);
    });
    
  } catch (error) {
    console.error('Error testing worker stats:', error);
  } finally {
    mongoose.disconnect();
  }
}

testWorkerStats(); 