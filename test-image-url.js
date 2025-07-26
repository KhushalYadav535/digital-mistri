import fetch from 'node-fetch';

const testImageUrl = async (url) => {
  try {
    console.log(`🔗 Testing image URL: ${url}`);
    const response = await fetch(url, { method: 'HEAD' });
    console.log(`   Status: ${response.status}`);
    console.log(`   Content-Type: ${response.headers.get('content-type')}`);
    console.log(`   ✅ Image URL is accessible`);
    return true;
  } catch (error) {
    console.log(`   ❌ Image URL failed: ${error.message}`);
    return false;
  }
};

const testAllImageUrls = async () => {
  const testUrls = [
    'https://httpbin.org/image/png',
    'https://via.placeholder.com/400x300/007AFF/FFFFFF?text=Test+Shop',
    'https://picsum.photos/400/300?random=1',
    'http://localhost:5000/uploads/image-1752773543009.png',
    'http://192.168.1.43:5000/uploads/image-1752773543009.png'
  ];
  
  console.log('🧪 Testing Image URLs...\n');
  
  for (const url of testUrls) {
    await testImageUrl(url);
    console.log('');
  }
  
  console.log('💡 Recommendations:');
  console.log('1. Use https://httpbin.org/image/png for reliable placeholder images');
  console.log('2. Check if local image files exist in uploads folder');
  console.log('3. Verify network connectivity for external image services');
};

// Run the test
testAllImageUrls(); 