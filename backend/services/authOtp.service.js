const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const AuthOtp = require('../models/AuthOtp.model');
const EmailLog = require('../models/EmailLog.model');
const User = require('../models/User.model');
const { sendEmail } = require('../utils/emailService');
const { otpEmail } = require('../utils/emailTemplates');
const { JWT_SECRET, JWT_EXPIRES_IN, WEB_CLIENT_URL } = require('../config/env');

const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 3;
const OTP_COOLDOWN_MINUTES = 5;
const OTP_RESEND_SECONDS = 60;
const OTP_MAX_SENDS_PER_HOUR = 3;
const OTP_SEND_WINDOW_MS = 60 * 60 * 1000;
const SESSION_EXPIRES_IN = JWT_EXPIRES_IN;
const SIGNUP_TOKEN_EXPIRES_IN = '15m';

const tokenLifetimeMs = (value) => {
  const match = String(value || '').trim().match(/^(\d+)\s*([smhd])$/i);
  if (!match) return 24 * 60 * 60 * 1000;
  const multiplier = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2].toLowerCase()];
  return Number(match[1]) * multiplier;
};

const normalizeEmail = (email = '') => String(email).trim().toLowerCase();

const isValidEmail = (email) => /^\S+@\S+\.\S+$/.test(email);

const generateOtp = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');

const hashOtp = (email, otp) => {
  return crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${normalizeEmail(email)}:${otp}`)
    .digest('hex');
};

const secondsUntil = (date) => Math.max(0, Math.ceil((date.getTime() - Date.now()) / 1000));

const logOtpEmail = async ({ email, subject, status, error }) => {
  try {
    await EmailLog.create({
      recipient_email: email,
      subject: subject || 'Auradime verification code',
      message_preview: 'Email OTP verification code',
      role: 'user',
      status,
      error: error ? String(error).slice(0, 500) : undefined,
    });
  } catch (logError) {
    console.warn('[auth:otp] Failed to write email log:', logError.message);
  }
};

const createAuthToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      tokenVersion: user.token_version || 0,
      type: 'auth',
    },
    JWT_SECRET,
    { expiresIn: SESSION_EXPIRES_IN }
  );
};

const createSignupToken = (email) => {
  return jwt.sign({ email: normalizeEmail(email), type: 'signup' }, JWT_SECRET, {
    expiresIn: SIGNUP_TOKEN_EXPIRES_IN,
  });
};

const verifySignupToken = (token) => {
  const decoded = jwt.verify(token, JWT_SECRET);
  if (decoded.type !== 'signup' || !decoded.email) {
    throw new Error('Invalid signup token.');
  }
  return normalizeEmail(decoded.email);
};

const setAuthCookie = (res, token) => {
  const isProduction = process.env.NODE_ENV === 'production';

  res.cookie('aura_token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    // Keep browser cookie lifetime exactly aligned with the signed JWT.
    maxAge: tokenLifetimeMs(SESSION_EXPIRES_IN),
    path: '/',
  });
};

const clearAuthCookie = (res) => {
  const isProduction = process.env.NODE_ENV === 'production';

  res.clearCookie('aura_token', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
  });
};

const sendOtpToEmail = async (email) => {
  const normalizedEmail = normalizeEmail(email);
  if (!isValidEmail(normalizedEmail)) {
    const error = new Error('Please provide a valid email address.');
    error.statusCode = 400;
    throw error;
  }

  const now = new Date();
  const otpRecord = await AuthOtp.findOne({ email: normalizedEmail }).select('+otp_hash');

  if (otpRecord?.cooldown_until && otpRecord.cooldown_until > now) {
    const error = new Error('Too many attempts. Please wait before requesting another code.');
    error.statusCode = 429;
    error.retryAfter = secondsUntil(otpRecord.cooldown_until);
    throw error;
  }

  if (otpRecord?.last_sent_at) {
    const resendAt = new Date(otpRecord.last_sent_at.getTime() + OTP_RESEND_SECONDS * 1000);
    if (resendAt > now) {
      const error = new Error('Please wait before requesting another code.');
      error.statusCode = 429;
      error.retryAfter = secondsUntil(resendAt);
      throw error;
    }
  }

  let sendWindowStart = otpRecord?.send_window_start || now;
  let sendCount = otpRecord?.send_count || 0;

  if (now.getTime() - sendWindowStart.getTime() >= OTP_SEND_WINDOW_MS) {
    sendWindowStart = now;
    sendCount = 0;
  }

  if (sendCount >= OTP_MAX_SENDS_PER_HOUR) {
    const retryAt = new Date(sendWindowStart.getTime() + OTP_SEND_WINDOW_MS);
    const error = new Error('OTP send limit reached. Please try again later.');
    error.statusCode = 429;
    error.retryAfter = secondsUntil(retryAt);
    throw error;
  }

  const otp = generateOtp();
  const expiresAt = new Date(now.getTime() + OTP_TTL_MINUTES * 60 * 1000);

  await AuthOtp.findOneAndUpdate(
    { email: normalizedEmail },
    {
      email: normalizedEmail,
      otp_hash: hashOtp(normalizedEmail, otp),
      attempts: 0,
      expires_at: expiresAt,
      cooldown_until: null,
      last_sent_at: now,
      send_window_start: sendWindowStart,
      send_count: sendCount + 1,
      verified_at: null,
    },
    { upsert: true, runValidators: true }
  );

  const template = otpEmail({
    otp,
    email: normalizedEmail,
    expiresMinutes: OTP_TTL_MINUTES,
    webUrl: WEB_CLIENT_URL,
  });

  const sent = await sendEmail({
    to: normalizedEmail,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });

  if (!sent) {
    await logOtpEmail({
      email: normalizedEmail,
      subject: template.subject,
      status: 'failed',
      error: 'Email provider rejected or failed the OTP message.',
    });
    const error = new Error('We could not send the verification code. Please try again.');
    error.statusCode = 502;
    throw error;
  }

  await logOtpEmail({
    email: normalizedEmail,
    subject: template.subject,
    status: 'sent',
  });

  return {
    email: normalizedEmail,
    expiresInSeconds: OTP_TTL_MINUTES * 60,
    resendAfterSeconds: OTP_RESEND_SECONDS,
  };
};

const verifyOtpForEmail = async (email, otp) => {
  const normalizedEmail = normalizeEmail(email);
  if (!isValidEmail(normalizedEmail) || !/^\d{6}$/.test(String(otp || ''))) {
    const error = new Error('Please provide a valid email address and 6-digit code.');
    error.statusCode = 400;
    throw error;
  }

  const now = new Date();
  const otpRecord = await AuthOtp.findOne({ email: normalizedEmail }).select('+otp_hash');

  if (!otpRecord) {
    const error = new Error('Verification code not found. Please request a new code.');
    error.statusCode = 400;
    throw error;
  }

  if (otpRecord.cooldown_until && otpRecord.cooldown_until > now) {
    const error = new Error('Too many attempts. Please wait before trying again.');
    error.statusCode = 429;
    error.retryAfter = secondsUntil(otpRecord.cooldown_until);
    throw error;
  }

  if (otpRecord.expires_at <= now) {
    await AuthOtp.deleteOne({ _id: otpRecord._id });
    const error = new Error('Verification code expired. Please request a new code.');
    error.statusCode = 400;
    throw error;
  }

  const isMatch = crypto.timingSafeEqual(
    Buffer.from(otpRecord.otp_hash),
    Buffer.from(hashOtp(normalizedEmail, String(otp)))
  );

  if (!isMatch) {
    otpRecord.attempts += 1;
    if (otpRecord.attempts >= OTP_MAX_ATTEMPTS) {
      otpRecord.cooldown_until = new Date(now.getTime() + OTP_COOLDOWN_MINUTES * 60 * 1000);
    }
    await otpRecord.save();

    const error = new Error(
      otpRecord.attempts >= OTP_MAX_ATTEMPTS
        ? 'Too many incorrect codes. Please wait before trying again.'
        : 'Invalid verification code.'
    );
    error.statusCode = otpRecord.attempts >= OTP_MAX_ATTEMPTS ? 429 : 401;
    if (otpRecord.cooldown_until) error.retryAfter = secondsUntil(otpRecord.cooldown_until);
    throw error;
  }

  otpRecord.verified_at = now;
  await otpRecord.save();

  return normalizedEmail;
};

module.exports = {
  OTP_RESEND_SECONDS,
  OTP_TTL_MINUTES,
  clearAuthCookie,
  createAuthToken,
  createSignupToken,
  normalizeEmail,
  sendOtpToEmail,
  setAuthCookie,
  verifyOtpForEmail,
  verifySignupToken,
};
