import fetch from 'node-fetch';

const API_URL = 'http://localhost:5000/api';

const testCustomerIdExtraction = async () => {
  try {
    console.log('🔍 Testing Customer ID Extraction and Real Payment...');
    
    // Create a base64 test image
    const base64Image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    
    const testShopData = {
      name: 'Customer ID Test Shop - ' + new Date().toLocaleTimeString(),
      description: 'Testing customer ID extraction with real payment',
      phone: '9876543210',
      email: 'customer-id-test@example.com',
      address: {
        street: 'Customer ID Test Street',
        city: 'Test City',
        state: 'Test State',
        pincode: '123456'
      },
      location: {
        coordinates: [77.2090, 28.6139] // Delhi coordinates
      },
      services: ['Customer ID Test Service'],
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

    // Test with different customer IDs
    const testCustomerIds = [
      'test-customer-id-123',
      'real-customer-id-456',
      'customer-789'
    ];

    for (const customerId of testCustomerIds) {
      console.log(`\n👤 Testing with Customer ID: ${customerId}`);
      
      const response = await fetch(`${API_URL}/real-payment/nearby-shop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shopData: {
            ...testShopData,
            name: testShopData.name + ` - ${customerId}`
          },
          paymentAmount: 1000,
          paymentReference: `PAY_CUSTOMER_TEST_${Date.now()}_${customerId}`,
          customerId: customerId
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Payment successful!');
        console.log('Shop ID:', data.shopId);
        console.log('Customer ID:', customerId);
        console.log('Payment Amount:', data.paymentAmount);
        console.log('Subscription Type:', data.subscriptionType);
      } else {
        const errorText = await response.text();
        console.error('❌ Payment failed:', errorText);
      }
    }

    console.log('\n🎉 Customer ID testing completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
};

// Run the test
testCustomerIdExtraction(); 