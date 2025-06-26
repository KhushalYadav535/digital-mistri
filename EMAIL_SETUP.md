# Email Setup for OTP Functionality

## Problem
The worker OTP completion feature requires email credentials to send OTP codes to customers. Without proper email configuration, the "Request Completion" feature will fail.

## Solution

### 1. Create a .env file in the backend directory
Create a file named `.env` in the `backend/` directory with the following content:

```env
# Database Configuration
MONGODB_URI=mongodb://localhost:27017/digital-mistri-dev

# JWT Secret
JWT_SECRET=your_jwt_secret

# Email Configuration (for OTP functionality)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password_here

# Environment
NODE_ENV=development

# Server Configuration
PORT=5000
```

### 2. Set up Gmail App Password

1. Go to your Google Account settings
2. Enable 2-Factor Authentication if not already enabled
3. Go to Security → App passwords
4. Generate a new app password for "Mail"
5. Use this app password as `EMAIL_PASS` in your .env file

### 3. For Production (Render.com)

If deploying to Render.com, add these environment variables in your Render dashboard:

- `EMAIL_USER`: your_gmail@gmail.com
- `EMAIL_PASS`: your_app_password
- `JWT_SECRET`: your_jwt_secret
- `MONGODB_URI`: your_mongodb_connection_string

### 4. Alternative: Manual OTP (Development)

If email is not configured, the system will:
1. Generate OTP successfully
2. Store it in the database
3. Log the OTP to console
4. Return the OTP in the API response (for development)

Check server logs to see the generated OTP when email is not configured.

## Testing

1. Start the backend server
2. Try the "Request Completion" feature in the worker app
3. Check server logs for OTP generation
4. If email is configured, customer should receive OTP via email
5. If email is not configured, OTP will be in server logs and API response 