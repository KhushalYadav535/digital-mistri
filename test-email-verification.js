import { sendEmailVerificationOTP } from './utils/emailConfig.js';

// Test email verification system
async function testEmailVerification() {
  console.log('Testing email verification system...');
  
  try {
    // Test email verification OTP
    console.log('\n1. Testing email verification OTP...');
    await sendEmailVerificationOTP(
      'digitalmistri33@gmail.com',
      '123456',
      'Test Customer'
    );
    console.log('✅ Email verification OTP test passed');
    
    console.log('\n🎉 Email verification system test passed successfully!');
    console.log('Email verification is working properly.');
    
  } catch (error) {
    console.error('❌ Email verification test failed:', error.message);
    console.error('Error details:', error);
  }
}

// Run the test
testEmailVerification(); 