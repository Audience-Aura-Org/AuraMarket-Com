/**
 * config/env.js
 * Loads and validates required environment variables.
 * Call this at application startup before anything else.
 */

require('dotenv').config();

const requiredEnvVars = [
  'MONGODB_URI',
  'JWT_SECRET',
  'VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
  'PAYUNIT_WEBHOOK_SECRET',
  'EVERSEND_WEBHOOK_SECRET',
];

const validateEnv = () => {
  const missing = requiredEnvVars.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  // Hard guard: debug routes must never be enabled in production
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DEBUG_ROUTES === 'true') {
    console.error('❌ CRITICAL: ENABLE_DEBUG_ROUTES=true is not permitted in production. Refusing to start.');
    process.exit(1);
  }

  // Access tokens are bearer credentials. Long-lived values turn a leaked token
  // into a multi-year account takeover, and also make user-level revocation far
  // less useful. Keep the production lifetime bounded until a rotating refresh
  // token/session store is introduced.
  const tokenLifetime = String(process.env.JWT_EXPIRES_IN || '24h').trim();
  const lifetimeMatch = tokenLifetime.match(/^(\d+)\s*([smhd])$/i);
  const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  const lifetimeMs = lifetimeMatch
    ? Number(lifetimeMatch[1]) * unitMs[lifetimeMatch[2].toLowerCase()]
    : NaN;
  if (process.env.NODE_ENV === 'production' && (!Number.isFinite(lifetimeMs) || lifetimeMs <= 0 || lifetimeMs > 30 * 86_400_000)) {
    console.error('❌ JWT_EXPIRES_IN must be a positive duration of 30 days or less in production (recommended: 7d).');
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
  // Reduced from '1460d' (4 years) to '24h' — prevents indefinite token validity after compromise.
  // Mobile clients using long sessions should migrate to a refresh-token flow.
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  AWS_REGION: process.env.AWS_REGION || 'us-east-1',
  AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,
  AWS_S3_ENABLED: process.env.AWS_S3_ENABLED === 'true',
  WEB_CLIENT_URL: process.env.WEB_CLIENT_URL || 'http://localhost:3000',
  EMAIL_HOST: process.env.EMAIL_HOST || 'smtp.titan.email',
  EMAIL_PORT: parseInt(process.env.EMAIL_PORT, 10) || 587,
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASS: process.env.EMAIL_PASS,
  EMAIL_SECURE: process.env.EMAIL_SECURE === 'true',
  EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME || 'Aura Dime',
  EMAIL_FROM: process.env.EMAIL_FROM,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  // VAPID keys are now REQUIRED — no hardcoded fallbacks. See validateEnv().
  VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
  EVERSEND_CLIENT_ID: process.env.EVERSEND_CLIENT_ID,
  EVERSEND_CLIENT_SECRET: process.env.EVERSEND_CLIENT_SECRET,
  // EVERSEND_WEBHOOK_SECRET is now REQUIRED — see validateEnv().
  EVERSEND_WEBHOOK_SECRET: process.env.EVERSEND_WEBHOOK_SECRET,
  EVERSEND_BASE_URL: process.env.EVERSEND_BASE_URL || 'https://api.eversend.co/v1',
  PAYUNIT_API_USERNAME: process.env.PAYUNIT_API_USERNAME,
  PAYUNIT_API_PASSWORD: process.env.PAYUNIT_API_PASSWORD,
  PAYUNIT_LIVE_KEY: process.env.PAYUNIT_LIVE_KEY,
  PAYUNIT_SANDBOX_KEY: process.env.PAYUNIT_SANDBOX_KEY,
  PAYUNIT_MODE: process.env.PAYUNIT_MODE || 'live',
  PAYUNIT_BASE_URL: process.env.PAYUNIT_BASE_URL || 'https://gateway.payunit.net',
  // PAYUNIT_WEBHOOK_SECRET is now REQUIRED — see validateEnv().
  PAYUNIT_WEBHOOK_SECRET: process.env.PAYUNIT_WEBHOOK_SECRET,
  // Debug routes: disabled by default; must never be true in production.
  ENABLE_DEBUG_ROUTES: process.env.ENABLE_DEBUG_ROUTES === 'true',
  // Support admin email — the account with this address is auto-promoted to admin on login.
  // If unset, the auto-promotion feature is disabled (recommended for fresh deployments).
  SUPPORT_ADMIN_EMAIL: process.env.SUPPORT_ADMIN_EMAIL,
  // PawaPay Mobile Money (Cameroon — MTN/Orange)
  PAWAPAY_API_TOKEN: process.env.PAWAPAY_API_TOKEN,
  PAWAPAY_SANDBOX_MODE: process.env.PAWAPAY_SANDBOX_MODE === 'true',
  // Optional: PawaPay RSA public key in PEM format for full RFC-9421 webhook signature verification.
  // If unset, only Content-Digest (body hash) is verified on incoming callbacks.
  PAWAPAY_WEBHOOK_PUBLIC_KEY: process.env.PAWAPAY_WEBHOOK_PUBLIC_KEY || null,
  // Set to 'true' in production to enforce PawaPay's known callback IP allowlist
  // as an extra security layer on top of Content-Digest verification.
  PAWAPAY_ENFORCE_IP_ALLOWLIST: process.env.PAWAPAY_ENFORCE_IP_ALLOWLIST === 'true',
};
