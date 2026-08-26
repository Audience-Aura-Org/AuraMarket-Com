/**
 * middleware/auth.middleware.js
 * Auradime — JWT Authentication & Role-Based Access Control
 *
 * protect()         → verifies JWT; adds req.user to request
 * restrictTo(...roles) → limits access to specific roles
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User.model');
const { JWT_SECRET } = require('../config/env');

const parseCookieToken = (req) => {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').reduce((acc, part) => {
    const [rawKey, ...rawValue] = part.trim().split('=');
    if (!rawKey) return acc;
    acc[rawKey] = decodeURIComponent(rawValue.join('=') || '');
    return acc;
  }, {});

  return cookies.aura_token || null;
};

const getRequestToken = (req) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    return req.headers.authorization.split(' ')[1];
  }

  return parseCookieToken(req);
};

const isTokenVersionValid = (decoded, user) => {
  // Every access token must carry a session version. Accepting legacy tokens
  // without it defeats logout/password-change revocation for their full TTL.
  if (decoded.tokenVersion === undefined || decoded.tokenVersion === null) return false;
  return Number(decoded.tokenVersion) === Number(user.token_version || 0);
};

const isVerificationWriteAllowed = (req) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;

  const path = req.originalUrl || req.url || '';
  return [
    '/api/v1/users/kyc',
    '/api/v1/upload',
    '/api/v1/auth/delete-account',
  ].some((allowedPath) => path.startsWith(allowedPath));
};

const shouldRestrictForVerification = (user) => (
  user.role !== 'admin' && ['held', 'pending', 'rejected'].includes(user.verification_status)
);

// ─────────────────────────────────────────────
// protect — Verify JWT and attach user to req
// ─────────────────────────────────────────────
const protect = async (req, res, next) => {
  try {
    let token;

    // 1. Extract token from Authorization header or httpOnly cookie
    token = getRequestToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
      });
    }

    // 2. Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // 3. Find user by ID from token payload
    const user = await User.findById(decoded.id).select('-password +token_version');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'The user belonging to this token no longer exists.',
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Contact support.',
      });
    }

    if (!isTokenVersionValid(decoded, user)) {
      return res.status(401).json({
        success: false,
        message: 'This session is no longer valid.',
      });
    }

    if (shouldRestrictForVerification(user) && !isVerificationWriteAllowed(req)) {
      return res.status(423).json({
        success: false,
        code: 'VERIFICATION_REQUIRED',
        message: 'Verification is required before this action can be completed.',
        redirect: '/profile?tab=kyc',
      });
    }

    // 4. Attach user to request object
    req.user = user;
    next();
  } catch (error) {
    next(error); // Passed to global errorHandler
  }
};

// ─────────────────────────────────────────────
// restrictTo — Role-Based Access Control
// Usage: restrictTo('admin', 'vendor')
// ─────────────────────────────────────────────
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(' or ')}. Your role: ${req.user.role}.`,
      });
    }
    next();
  };
};

// ─────────────────────────────────────────────
// protectOptional — Only attach user if token exists
// ─────────────────────────────────────────────
const protectOptional = async (req, res, next) => {
  try {
    let token;
    token = getRequestToken(req);

    if (!token) return next();

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password +token_version');
    if (user && user.is_active && isTokenVersionValid(decoded, user)) {
      req.user = user;
    }
    next();
  } catch (error) {
    // If token is invalid, we just treat as guest rather than erroring
    next();
  }
};

// ─────────────────────────────────────────────
// loadVendor — Attach Vendor profile to request
// ─────────────────────────────────────────────
const loadVendor = async (req, res, next) => {
  try {
    const Vendor = require('../models/Vendor.model');
    const vendor = await Vendor.findOne({ user_id: req.user._id });
    
    if (!vendor && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Vendor profile not found. If you just signed up, please complete your profile onboarding first.'
      });
    }

    req.vendor = vendor;
    next();
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// loadVendorOptional — Attach Vendor profile silently (never blocks)
// Used on public routes that need to distinguish an owning vendor
// (e.g. GET /products/:id allowing a vendor to see their own pending product).
// ─────────────────────────────────────────────
const loadVendorOptional = async (req, res, next) => {
  try {
    if (req.user && req.user.role === 'vendor') {
      const Vendor = require('../models/Vendor.model');
      const vendor = await Vendor.findOne({ user_id: req.user._id });
      if (vendor) req.vendor = vendor;
    }
    next();
  } catch (_e) {
    // Non-fatal — proceed as a public request
    next();
  }
};

module.exports = { protect, restrictTo, protectOptional, loadVendor, loadVendorOptional };
