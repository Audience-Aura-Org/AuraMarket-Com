/**
 * config/env.js
 * Loads and validates required environment variables.
 * Call this at application startup before anything else.
 */

require('dotenv').config();

const requiredEnvVars = [
  'MONGODB_URI',
  'JWT_SECRET',
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
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1460d',
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
  EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME || 'Aura Dime',
  EMAIL_FROM: process.env.EMAIL_FROM,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
  EVERSEND_CLIENT_ID: process.env.EVERSEND_CLIENT_ID,
  EVERSEND_CLIENT_SECRET: process.env.EVERSEND_CLIENT_SECRET,
  EVERSEND_WEBHOOK_SECRET: process.env.EVERSEND_WEBHOOK_SECRET,
  EVERSEND_BASE_URL: process.env.EVERSEND_BASE_URL || 'https://api.eversend.co/v1',
  PAYUNIT_API_USERNAME: process.env.PAYUNIT_API_USERNAME,
  PAYUNIT_API_PASSWORD: process.env.PAYUNIT_API_PASSWORD,
  PAYUNIT_LIVE_KEY: process.env.PAYUNIT_LIVE_KEY,
  PAYUNIT_SANDBOX_KEY: process.env.PAYUNIT_SANDBOX_KEY,
  PAYUNIT_MODE: process.env.PAYUNIT_MODE || 'live',
  PAYUNIT_BASE_URL: process.env.PAYUNIT_BASE_URL || 'https://gateway.payunit.net',
};

