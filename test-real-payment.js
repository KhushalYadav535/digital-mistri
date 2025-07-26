import fetch from 'node-fetch';

const API_URL = 'http://localhost:5000/api';

const testRealPayment = async () => {
  try {
    console.log('💰 Testing Real Payment Flow...');
    
    // Create a base64 test image
    const base64Image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    
    const testShopData = {
      name: 'Real Payment Test Shop - ' + new Date().toLocaleTimeString(),
      description: 'Testing real payment flow with actual UPI payment',
      phone: '9876543210',
      email: 'real-payment-test@example.com',
      address: {
        street: 'Real Payment Test Street',
        city: 'Test City',
        state: 'Test State',
        pincode: '123456'
      },
      location: {
        coordinates: [77.2090, 28.6139] // Delhi coordinates
      },
      services: ['Real Payment Test Service'],
      workingHours: {
        monday: { open: '09:00', close: '18:00' },
        tuesday: { open: '09:00', close: '18:00' },
        wednesday: { open: '09:00', close: '18:00' },
        thursday: { open: '09:00', close: '18:00' },
        friday: { open: '09:00', close: '18:00' },
        saturday: { open: '09:00', close: '18:00' },
        sunday: { open: '09:00', close: '18:00' }
      },
      image: base64Image
    };

    console.log('📝 Test shop data prepared');
    console.log('🖼️ Base64 image length:', base64Image.length);

    // Test monthly payment (₹1000)
    console.log('\n📅 Testing Monthly Payment (₹1000)...');
    const monthlyResponse = await fetch(`${API_URL}/real-payment/nearby-shop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        shopData: {
          ...testShopData,
          name: testShopData.name + ' - Monthly'
        },
        paymentAmount: 1000,
        paymentReference: `PAY_MONTHLY_${Date.now()}`,
        customerId: 'test-customer-id-123'
      })
    });

    if (monthlyResponse.ok) {
      const monthlyData = await monthlyResponse.json();
      console.log('✅ Monthly payment successful!');
      console.log('Shop ID:', monthlyData.shopId);
      console.log('Payment Amount:', monthlyData.paymentAmount);
      console.log('Subscription Type:', monthlyData.subscriptionType);
    } else {
      const errorText = await monthlyResponse.text();
      console.error('❌ Monthly payment failed:', errorText);
    }

    // Test yearly payment (₹8000)
    console.log('\n📅 Testing Yearly Payment (₹8000)...');
    const yearlyResponse = await fetch(`${API_URL}/real-payment/nearby-shop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        shopData: {
          ...testShopData,
          name: testShopData.name + ' - Yearly'
        },
        paymentAmount: 8000,
        paymentReference: `PAY_YEARLY_${Date.now()}`,
        customerId: 'test-customer-id-456'
      })
    });

    if (yearlyResponse.ok) {
      const yearlyData = await yearlyResponse.json();
      console.log('✅ Yearly payment successful!');
      console.log('Shop ID:', yearlyData.shopId);
      console.log('Payment Amount:', yearlyData.paymentAmount);
      console.log('Subscription Type:', yearlyData.subscriptionType);
    } else {
      const errorText = await yearlyResponse.text();
      console.error('❌ Yearly payment failed:', errorText);
    }

    // Test invalid payment amount
    console.log('\n❌ Testing Invalid Payment Amount (₹500)...');
    const invalidResponse = await fetch(`${API_URL}/real-payment/nearby-shop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        shopData: {
          ...testShopData,
          name: testShopData.name + ' - Invalid'
        },
        paymentAmount: 500,
        paymentReference: `PAY_INVALID_${Date.now()}`,
        customerId: 'test-customer-id-789'
      })
    });

    if (!invalidResponse.ok) {
      const invalidData = await invalidResponse.json();
      console.log('✅ Invalid payment correctly rejected!');
      console.log('Error Message:', invalidData.message);
    } else {
      console.error('❌ Invalid payment was accepted (should have been rejected)');
    }

    console.log('\n🎉 Real payment testing completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
};

// Run the test
testRealPayment(); 