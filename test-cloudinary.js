import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dejav0pow',
  api_key: process.env.CLOUDINARY_API_KEY || '239964127998336',
  api_secret: process.env.CLOUDINARY_API_SECRET || '1AS2IFYFe9mXwS31ZH1gYTNJs3g',
});

async function testCloudinary() {
  try {
    console.log('🔗 Testing Cloudinary connection...');
    
    // Test 1: Check if we can access Cloudinary
    console.log('\n📋 Cloudinary Configuration:');
    console.log('Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME || 'dejav0pow');
    console.log('API Key:', process.env.CLOUDINARY_API_KEY ? '✅ Set' : '❌ Missing');
    console.log('API Secret:', process.env.CLOUDINARY_API_SECRET ? '✅ Set' : '❌ Missing');
    
    // Test 2: Try to get account info
    console.log('\n🔍 Testing API connection...');
    const accountInfo = await cloudinary.api.ping();
    console.log('✅ Cloudinary connection successful!');
    console.log('Response:', accountInfo);
    
    // Test 3: Test upload functionality with a sample image
    console.log('\n📤 Testing upload functionality...');
    
    // Create a simple test image (1x1 pixel transparent PNG)
    const testImageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    
    const uploadResult = await cloudinary.uploader.upload(testImageData, {
      folder: 'digital-mistri/test',
      public_id: 'test-connection',
      overwrite: true
    });
    
    console.log('✅ Upload test successful!');
    console.log('Uploaded URL:', uploadResult.secure_url);
    console.log('Public ID:', uploadResult.public_id);
    
    // Test 4: Test optimization
    console.log('\n⚡ Testing image optimization...');
    const optimizedUrl = cloudinary.url(uploadResult.public_id, {
      width: 100,
      height: 100,
      crop: 'fill',
      quality: 'auto:good',
      fetch_format: 'auto'
    });
    
    console.log('✅ Optimization test successful!');
    console.log('Optimized URL:', optimizedUrl);
    
    // Test 5: Test responsive URLs
    console.log('\n📱 Testing responsive URLs...');
    const responsiveUrls = {
      thumbnail: cloudinary.url(uploadResult.public_id, { width: 150, height: 150, crop: 'fill' }),
      small: cloudinary.url(uploadResult.public_id, { width: 300, height: 300, crop: 'fill' }),
      medium: cloudinary.url(uploadResult.public_id, { width: 600, height: 600, crop: 'fill' }),
      large: cloudinary.url(uploadResult.public_id, { width: 1000, height: 1000, crop: 'limit' })
    };
    
    console.log('✅ Responsive URLs generated:');
    Object.entries(responsiveUrls).forEach(([size, url]) => {
      console.log(`  ${size}: ${url}`);
    });
    
    // Test 6: Clean up test image
    console.log('\n🧹 Cleaning up test image...');
    const deleteResult = await cloudinary.uploader.destroy(uploadResult.public_id);
    console.log('✅ Test image deleted:', deleteResult);
    
    console.log('\n🎉 All Cloudinary tests passed! Your setup is ready to use.');
    console.log('\n📝 Next steps:');
    console.log('1. Start your backend server');
    console.log('2. Test image uploads from your app');
    console.log('3. Run migration script if needed: npm run migrate-images');
    
  } catch (error) {
    console.error('❌ Cloudinary test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check your Cloudinary credentials');
    console.log('2. Ensure internet connection');
    console.log('3. Verify Cloudinary account is active');
  }
}

// Run the test
testCloudinary(); 