import nodemailer from 'nodemailer';

// Email configuration
const EMAIL_CONFIG = {
  user: 'digitalmistri33@gmail.com',
  pass: 'mdej pjnp pkth uepf'
};

// Create transporter
export const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: EMAIL_CONFIG.user,
      pass: EMAIL_CONFIG.pass
    }
  });
};

// Helper function to send email
export const sendEmail = async (to, subject, html, text = '') => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: EMAIL_CONFIG.user,
      to: to,
      subject: subject,
      html: html,
      text: text
    };

    const result = await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully to ${to}`);
    return result;
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
};

// Helper function to send password reset email
export const sendPasswordResetEmail = async (to, otp, customerName) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #007AFF; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">Digital Mistri</h1>
        <p style="margin: 5px 0 0 0; font-size: 16px;">Password Reset Request</p>
      </div>
      
      <div style="background-color: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
        <h2 style="color: #333; margin-bottom: 20px;">Hello ${customerName},</h2>
        
        <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
          We received a request to reset your password for your Digital Mistri account. 
          Use the OTP below to complete your password reset:
        </p>
        
        <div style="background-color: #007AFF; color: white; padding: 20px; text-align: center; border-radius: 8px; margin: 30px 0;">
          <h1 style="margin: 0; font-size: 32px; letter-spacing: 5px;">${otp}</h1>
          <p style="margin: 10px 0 0 0; font-size: 14px;">Your 6-digit OTP</p>
        </div>
        
        <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
          <strong>Important:</strong>
        </p>
        <ul style="color: #666; line-height: 1.6; margin-bottom: 20px;">
          <li>This OTP is valid for 10 minutes only</li>
          <li>Do not share this OTP with anyone</li>
          <li>If you didn't request this, please ignore this email</li>
        </ul>
        
        <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
          If you have any questions, please contact our support team.
        </p>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
          <p style="color: #999; font-size: 12px;">
            This is an automated email. Please do not reply to this message.
          </p>
        </div>
      </div>
    </div>
  `;

  return await sendEmail(
    to,
    'Password Reset OTP - Digital Mistri',
    html
  );
};

// Helper function to send OTP email for service completion
export const sendOtpEmail = async (to, otp, serviceTitle) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #007AFF; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">Digital Mistri</h1>
        <p style="margin: 5px 0 0 0; font-size: 16px;">Service Completion OTP</p>
      </div>
      
      <div style="background-color: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
        <h2 style="color: #333; margin-bottom: 20px;">Service Completion Verification</h2>
        
        <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
          Your worker has completed the service: <strong>${serviceTitle}</strong>
        </p>
        
        <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
          Please provide the following OTP to your worker to confirm service completion:
        </p>
        
        <div style="background-color: #007AFF; color: white; padding: 20px; text-align: center; border-radius: 8px; margin: 30px 0;">
          <h1 style="margin: 0; font-size: 32px; letter-spacing: 5px;">${otp}</h1>
          <p style="margin: 10px 0 0 0; font-size: 14px;">Your 6-digit OTP</p>
        </div>
        
        <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
          <strong>Important:</strong>
        </p>
        <ul style="color: #666; line-height: 1.6; margin-bottom: 20px;">
          <li>This OTP is valid for 10 minutes only</li>
          <li>Only provide this OTP to your assigned worker</li>
          <li>This confirms that the service has been completed to your satisfaction</li>
        </ul>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
          <p style="color: #999; font-size: 12px;">
            This is an automated email from Digital Mistri.
          </p>
        </div>
      </div>
    </div>
  `;

  return await sendEmail(
    to,
    `OTP for Service Completion: ${serviceTitle}`,
    html
  );
};

// Helper function to send email verification OTP
export const sendEmailVerificationOTP = async (to, otp, customerName) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #007AFF; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">Digital Mistri</h1>
        <p style="margin: 5px 0 0 0; font-size: 16px;">Email Verification</p>
      </div>
      
      <div style="background-color: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
        <h2 style="color: #333; margin-bottom: 20px;">Hello ${customerName},</h2>
        
        <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
          Welcome to Digital Mistri! Please verify your email address to complete your registration.
          Use the OTP below to verify your email:
        </p>
        
        <div style="background-color: #007AFF; color: white; padding: 20px; text-align: center; border-radius: 8px; margin: 30px 0;">
          <h1 style="margin: 0; font-size: 32px; letter-spacing: 5px;">${otp}</h1>
          <p style="margin: 10px 0 0 0; font-size: 14px;">Your 6-digit verification OTP</p>
        </div>
        
        <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
          <strong>Important:</strong>
        </p>
        <ul style="color: #666; line-height: 1.6; margin-bottom: 20px;">
          <li>This OTP is valid for 10 minutes only</li>
          <li>Do not share this OTP with anyone</li>
          <li>Your account will be activated after email verification</li>
        </ul>
        
        <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
          Thank you for choosing Digital Mistri!
        </p>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
          <p style="color: #999; font-size: 12px;">
            This is an automated email. Please do not reply to this message.
          </p>
        </div>
      </div>
    </div>
  `;

  return await sendEmail(
    to,
    'Email Verification OTP - Digital Mistri',
    html
  );
};

// Helper function to send support email
export const sendSupportEmail = async (customer, message) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #007AFF; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">Digital Mistri</h1>
        <p style="margin: 5px 0 0 0; font-size: 16px;">New Support Request</p>
      </div>
      
      <div style="background-color: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
        <h2 style="color: #333; margin-bottom: 20px;">Customer Details</h2>
        
        <div style="background-color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <p style="margin: 5px 0; color: #666;"><strong>Name:</strong> ${customer.name}</p>
          <p style="margin: 5px 0; color: #666;"><strong>Email:</strong> ${customer.email}</p>
          <p style="margin: 5px 0; color: #666;"><strong>Phone:</strong> ${customer.phone}</p>
          <p style="margin: 5px 0; color: #666;"><strong>Date:</strong> ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
        </div>
        
        <h3 style="color: #333; margin-bottom: 15px;">Message</h3>
        <div style="background-color: white; padding: 20px; border-radius: 8px; border-left: 4px solid #007AFF;">
          <p style="color: #333; line-height: 1.6; margin: 0; white-space: pre-wrap;">${message}</p>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
          <p style="color: #999; font-size: 12px;">
            This is an automated email from Digital Mistri support system.
          </p>
        </div>
      </div>
    </div>
  `;

  return await sendEmail(
    'digitalmistri33@gmail.com',
    `Support Request from ${customer.name}`,
    html
  );
};

export default {
  createTransporter,
  sendEmail,
  sendPasswordResetEmail,
  sendOtpEmail,
  sendSupportEmail,
  sendEmailVerificationOTP
}; 