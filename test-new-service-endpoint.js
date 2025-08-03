import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

const testNewServiceEndpoint = async () => {
  try {
    console.log('Testing /services/all endpoint...');
    
    const response = await axios.get(`${API_URL}/services/all`);
    
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    
    // Check if we have any services
    const serviceTypes = Object.keys(response.data);
    console.log(`Found ${serviceTypes.length} service types:`, serviceTypes);
    
    // Check each service type
    serviceTypes.forEach(serviceType => {
      const serviceData = response.data[serviceType];
      console.log(`\n${serviceType}:`);
      console.log(`  Name: ${serviceData.name}`);
      console.log(`  Description: ${serviceData.description}`);
      console.log(`  Services count: ${serviceData.services.length}`);
      
      serviceData.services.forEach(service => {
        console.log(`    - ${service.title}: ${service.price}`);
      });
    });
    
  } catch (error) {
    console.error('Error testing endpoint:', error.response?.data || error.message);
  }
};

testNewServiceEndpoint(); 