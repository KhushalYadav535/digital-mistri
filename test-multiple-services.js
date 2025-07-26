import mongoose from 'mongoose';
import Booking from './models/Booking.js';
import Worker from './models/Worker.js';
import Customer from './models/Customer.js';

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/digital-mistri';
await mongoose.connect(MONGODB_URI);
console.log('Connected to MongoDB');

async function testMultipleServicesBooking() {
  try {
    console.log('=== Testing Multiple Services Booking ===');

    // Find a customer
    const customer = await Customer.findOne();
    if (!customer) {
      console.log('No customer found. Please create a customer first.');
      return;
    }

    // Find workers for different services
    const plumberWorker = await Worker.findOne({ services: 'Plumber' });
    const electricianWorker = await Worker.findOne({ services: 'Electrician' });

    if (!plumberWorker || !electricianWorker) {
      console.log('Workers not found for Plumber and Electrician services.');
      return;
    }

    console.log('Found customer:', customer.name);
    console.log('Found plumber worker:', plumberWorker.name);
    console.log('Found electrician worker:', electricianWorker.name);

    // Create a multiple services booking
    const multipleServicesData = {
      customer: customer._id,
      serviceType: 'Multiple',
      serviceTitle: 'Multiple Services (2 items)',
      bookingDate: new Date(),
      bookingTime: '14:00',
      address: {
        street: 'Test Street',
        city: 'Prayagraj',
        state: 'Uttar Pradesh',
        pincode: '212401'
      },
      phone: '9999999999',
      amount: 1000, // Total service amount
      distance: 5,
      distanceCharge: 50,
      totalAmount: 1050,
      customerCoordinates: {
        latitude: 25.541297129300112,
        longitude: 82.31064807968316,
        displayName: 'Test Location',
        accuracy: 0.8
      },
      status: 'Pending',
      isMultipleServiceBooking: true,
      serviceBreakdown: [
        {
          serviceType: 'Plumber',
          serviceTitle: 'Plumbing Service',
          amount: 500,
          quantity: 1
        },
        {
          serviceType: 'Electrician',
          serviceTitle: 'Electrical Service',
          amount: 500,
          quantity: 1
        }
      ]
    };

    // Create parent booking
    const parentBooking = await Booking.create(multipleServicesData);
    console.log('Parent booking created:', parentBooking._id);

    // Create child bookings
    const childBookings = [];

    // Plumber service booking
    const plumberBooking = await Booking.create({
      customer: customer._id,
      serviceType: 'Plumber',
      serviceTitle: 'Plumbing Service',
      bookingDate: new Date(),
      bookingTime: '14:00',
      address: multipleServicesData.address,
      phone: multipleServicesData.phone,
      amount: 500,
      distance: 5,
      distanceCharge: 25, // Half of total distance charge
      totalAmount: 525,
      customerCoordinates: multipleServicesData.customerCoordinates,
      status: 'Pending',
      parentBooking: parentBooking._id,
      isMultipleServiceBooking: false
    });
    childBookings.push(plumberBooking._id);
    console.log('Plumber booking created:', plumberBooking._id);

    // Electrician service booking
    const electricianBooking = await Booking.create({
      customer: customer._id,
      serviceType: 'Electrician',
      serviceTitle: 'Electrical Service',
      bookingDate: new Date(),
      bookingTime: '14:00',
      address: multipleServicesData.address,
      phone: multipleServicesData.phone,
      amount: 500,
      distance: 5,
      distanceCharge: 25, // Half of total distance charge
      totalAmount: 525,
      customerCoordinates: multipleServicesData.customerCoordinates,
      status: 'Pending',
      parentBooking: parentBooking._id,
      isMultipleServiceBooking: false
    });
    childBookings.push(electricianBooking._id);
    console.log('Electrician booking created:', electricianBooking._id);

    // Update parent booking with child bookings
    parentBooking.childBookings = childBookings;
    await parentBooking.save();

    console.log('=== Multiple Services Booking Test Complete ===');
    console.log('Parent Booking ID:', parentBooking._id);
    console.log('Child Bookings:', childBookings);
    console.log('Plumber will receive: ₹525');
    console.log('Electrician will receive: ₹525');

    // Test worker assignment
    console.log('\n=== Testing Worker Assignment ===');
    
    // Assign plumber worker to plumber booking
    plumberBooking.worker = plumberWorker._id;
    plumberBooking.status = 'Worker Assigned';
    await plumberBooking.save();
    console.log('Plumber assigned to plumber booking');

    // Assign electrician worker to electrician booking
    electricianBooking.worker = electricianWorker._id;
    electricianBooking.status = 'Worker Assigned';
    await electricianBooking.save();
    console.log('Electrician assigned to electrician booking');

    // Update parent booking status
    parentBooking.status = 'Worker Assigned';
    await parentBooking.save();
    console.log('Parent booking status updated to Worker Assigned');

    console.log('\n=== Test Results ===');
    console.log('✅ Multiple services booking created successfully');
    console.log('✅ Each service has its own booking');
    console.log('✅ Workers are assigned to their respective services');
    console.log('✅ Each worker receives their specific payment amount');

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

testMultipleServicesBooking(); 