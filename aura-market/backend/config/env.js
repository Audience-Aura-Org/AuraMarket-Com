/**
 * config/env.js
 * Loads and validates required environment variables.
 * Call this at application startup before anything else.
 */

require('dotenv').config();

const requiredEnvVars = [
  'MONGODB_URI',
  'JWT_SECRET',
  'JWT_EXPIRES_IN',
];

const validateEnv = () => {
  const missing = requiredEnvVars.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  console.log('✅ Environment variables validated.');
};

module.exports = {
  validateEnv,
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGODB_URI: process.env.MONGODB_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  AWS_REGION: process.env.AWS_REGION || 'us-east-1',
  AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,
  AWS_S3_ENABLED: process.env.AWS_S3_ENABLED === 'true',
  WEB_CLIENT_URL: process.env.WEB_CLIENT_URL || 'http://localhost:3000',
  PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY,
  EMAIL_HOST: process.env.EMAIL_HOST || 'smtp.titan.email',
  EMAIL_PORT: parseInt(process.env.EMAIL_PORT, 10) || 587,
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASS: process.env.EMAIL_PASS,
  EMAIL_SECURE: process.env.EMAIL_SECURE === 'true',
  EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME || 'Aura Market',
  EVERSEND_CLIENT_ID: process.env.EVERSEND_CLIENT_ID,
  EVERSEND_CLIENT_SECRET: process.env.EVERSEND_CLIENT_SECRET,
  EVERSEND_WEBHOOK_SECRET: process.env.EVERSEND_WEBHOOK_SECRET,
  EVERSEND_BASE_URL: process.env.EVERSEND_BASE_URL || 'https://api.eversend.co/v1',
  EVERSEND_ORIGIN: process.env.EVERSEND_ORIGIN || 'http://localhost:3000',
  EVERSEND_SANDBOX_MODE: process.env.EVERSEND_SANDBOX_MODE === 'true',
};

