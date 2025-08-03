import axios from 'axios';

const API_URL = 'http://localhost:3000/api';

// Test worker endpoints
const testEndpoints = async () => {
  console.log('=== Testing Worker API Endpoints ===\n');

  try {
    // Test 1: Check if worker bookings endpoint exists
    console.log('1. Testing GET /api/worker/bookings');
    try {
      const response = await axios.get(`${API_URL}/worker/bookings`);
      console.log('✅ GET /api/worker/bookings - Status:', response.status);
    } catch (error) {
      console.log('❌ GET /api/worker/bookings - Error:', error.response?.status, error.response?.data?.message);
    }

    // Test 2: Check if worker unassigned bookings endpoint exists
    console.log('\n2. Testing GET /api/worker/unassigned-bookings');
    try {
      const response = await axios.get(`${API_URL}/worker/unassigned-bookings`);
      console.log('✅ GET /api/worker/unassigned-bookings - Status:', response.status);
    } catch (error) {
      console.log('❌ GET /api/worker/unassigned-bookings - Error:', error.response?.status, error.response?.data?.message);
    }

    // Test 3: Check if worker completed bookings endpoint exists
    console.log('\n3. Testing GET /api/worker/completed-bookings');
    try {
      const response = await axios.get(`${API_URL}/worker/completed-bookings`);
      console.log('✅ GET /api/worker/completed-bookings - Status:', response.status);
    } catch (error) {
      console.log('❌ GET /api/worker/completed-bookings - Error:', error.response?.status, error.response?.data?.message);
    }

    // Test 4: Check if accept booking endpoint exists (should return 401 without auth)
    console.log('\n4. Testing PUT /api/worker/bookings/:id/accept');
    try {
      const response = await axios.put(`${API_URL}/worker/bookings/test-id/accept`);
      console.log('✅ PUT /api/worker/bookings/:id/accept - Status:', response.status);
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ PUT /api/worker/bookings/:id/accept - Requires auth (401)');
      } else {
        console.log('❌ PUT /api/worker/bookings/:id/accept - Error:', error.response?.status, error.response?.data?.message);
      }
    }

    // Test 5: Check if reject booking endpoint exists (should return 401 without auth)
    console.log('\n5. Testing PUT /api/worker/bookings/:id/reject');
    try {
      const response = await axios.put(`${API_URL}/worker/bookings/test-id/reject`);
      console.log('✅ PUT /api/worker/bookings/:id/reject - Status:', response.status);
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ PUT /api/worker/bookings/:id/reject - Requires auth (401)');
      } else {
        console.log('❌ PUT /api/worker/bookings/:id/reject - Error:', error.response?.status, error.response?.data?.message);
      }
    }

    // Test 6: Check if job start endpoint exists (should return 401 without auth)
    console.log('\n6. Testing POST /api/worker/jobs/:id/start');
    try {
      const response = await axios.post(`${API_URL}/worker/jobs/test-id/start`);
      console.log('✅ POST /api/worker/jobs/:id/start - Status:', response.status);
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ POST /api/worker/jobs/:id/start - Requires auth (401)');
      } else {
        console.log('❌ POST /api/worker/jobs/:id/start - Error:', error.response?.status, error.response?.data?.message);
      }
    }

    // Test 7: Check if job complete endpoint exists (should return 401 without auth)
    console.log('\n7. Testing POST /api/worker/jobs/:id/complete');
    try {
      const response = await axios.post(`${API_URL}/worker/jobs/test-id/complete`);
      console.log('✅ POST /api/worker/jobs/:id/complete - Status:', response.status);
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ POST /api/worker/jobs/:id/complete - Requires auth (401)');
      } else {
        console.log('❌ POST /api/worker/jobs/:id/complete - Error:', error.response?.status, error.response?.data?.message);
      }
    }

    // Test 8: Check if job cancel endpoint exists (should return 401 without auth)
    console.log('\n8. Testing POST /api/worker/jobs/:id/cancel');
    try {
      const response = await axios.post(`${API_URL}/worker/jobs/test-id/cancel`);
      console.log('✅ POST /api/worker/jobs/:id/cancel - Status:', response.status);
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ POST /api/worker/jobs/:id/cancel - Requires auth (401)');
      } else {
        console.log('❌ POST /api/worker/jobs/:id/cancel - Error:', error.response?.status, error.response?.data?.message);
      }
    }

  } catch (error) {
    console.error('Test failed:', error.message);
  }

  console.log('\n=== Endpoint Test Completed ===');
};

testEndpoints(); 