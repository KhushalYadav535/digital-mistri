import fetch from 'node-fetch';

const API_URL = 'http://localhost:5000/api';

const testImageIssue = async () => {
  try {
    console.log('🔍 Testing Image Issue...');
    
    // Step 1: Check what shops exist in the database
    const shopsResponse = await fetch(`${API_URL}/nearby-shops?latitude=28.6139&longitude=77.2090&radius=50`);
    const shopsData = await shopsResponse.json();
    
    console.log('📊 Total shops found:', shopsData.length);
    
    // Step 2: Analyze each shop's image data
    shopsData.forEach((shop, index) => {
      console.log(`\n🏪 Shop ${index + 1}: "${shop.name}"`);
      console.log('   ID:', shop._id);
      console.log('   Images array:', shop.images);
      console.log('   Images type:', typeof shop.images);
      console.log('   Images length:', shop.images ? shop.images.length : 'N/A');
      console.log('   First image:', shop.images && shop.images.length > 0 ? shop.images[0] : 'No image');
      console.log('   Image URL type:', shop.images && shop.images.length > 0 ? typeof shop.images[0] : 'N/A');
    });
    
    // Step 3: Test image URL construction
    if (shopsData.length > 0 && shopsData[0].images && shopsData[0].images.length > 0) {
      const testImage = shopsData[0].images[0];
      console.log('\n🔗 Testing image URL construction:');
      console.log('   Original image:', testImage);
      console.log('   Is HTTP URL:', testImage.startsWith('http'));
      console.log('   Is HTTPS URL:', testImage.startsWith('https'));
      console.log('   Is placeholder:', testImage.includes('placeholder'));
    }
    
  } catch (error) {
    console.error('❌ Error testing image issue:', error.message);
  }
};

// Run the test
testImageIssue(); 