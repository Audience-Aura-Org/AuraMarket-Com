/**
 * middleware/auth.middleware.js
 * Aura Market — JWT Authentication & Role-Based Access Control
 *
 * protect()         → verifies JWT; adds req.user to request
 * restrictTo(...roles) → limits access to specific roles
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User.model');
const { JWT_SECRET } = require('../config/env');

// ─────────────────────────────────────────────
// protect — Verify JWT and attach user to req
// ─────────────────────────────────────────────
const protect = async (req, res, next) => {
  try {
    let token;

    // 1. Extract token from Authorization header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
      });
    }

    // 2. Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // 3. Find user by ID from token payload
    const user = await User.findById(decoded.id).select('-password');

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
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) return next();

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (user && user.is_active) {
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

module.exports = { protect, restrictTo, protectOptional, loadVendor };
