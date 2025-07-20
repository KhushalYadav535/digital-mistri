import { sendEmail, sendPasswordResetEmail, sendOtpEmail, sendSupportEmail } from './utils/emailConfig.js';

// Test email configuration
async function testEmailConfig() {
  console.log('Testing email configuration...');
  
  try {
    // Test 1: Simple email
    console.log('\n1. Testing simple email...');
    await sendEmail(
      'digitalmistri33@gmail.com',
      'Test Email - Digital Mistri',
      '<h1>Test Email</h1><p>This is a test email from Digital Mistri application.</p>'
    );
    console.log('✅ Simple email test passed');
    
    // Test 2: Password reset email
    console.log('\n2. Testing password reset email...');
    await sendPasswordResetEmail(
      'digitalmistri33@gmail.com',
      '123456',
      'Test Customer'
    );
    console.log('✅ Password reset email test passed');
    
    // Test 3: OTP email
    console.log('\n3. Testing OTP email...');
    await sendOtpEmail(
      'digitalmistri33@gmail.com',
      '789012',
      'Test Service'
    );
    console.log('✅ OTP email test passed');
    
    // Test 4: Support email
    console.log('\n4. Testing support email...');
    const testCustomer = {
      name: 'Test Customer',
      email: 'test@example.com',
      phone: '1234567890'
    };
    await sendSupportEmail(
      testCustomer,
      'This is a test support message from the Digital Mistri application.'
    );
    console.log('✅ Support email test passed');
    
    console.log('\n🎉 All email tests passed successfully!');
    console.log('Email configuration is working properly.');
    
  } catch (error) {
    console.error('❌ Email test failed:', error.message);
    console.error('Error details:', error);
  }
}

// Run the test
testEmailConfig(); 