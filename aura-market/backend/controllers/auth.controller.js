/**
 * controllers/auth.controller.js
 * Aura Market — Authentication Controller
 *
 * register() → create a new user account
 * login()    → authenticate and return JWT
 * getMe()    → return the current logged-in user
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User.model');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/env');

let otplibAuthenticator;
const getAuthenticator = async () => {
  if (!otplibAuthenticator) {
    const otplib = await import('otplib');
    otplibAuthenticator = otplib.authenticator;
  }
  return otplibAuthenticator;
};

// ─────────────────────────────────────────────
// Helper: Sign a JWT for a given user ID
// ─────────────────────────────────────────────
const signToken = (id) => {
  return jwt.sign({ id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// ─────────────────────────────────────────────
// Helper: Send token response
// ─────────────────────────────────────────────
const sendTokenResponse = (user, statusCode, res) => {
  const token = signToken(user._id);

  // Remove password from output (extra safety)
  user.password = undefined;

  res.status(statusCode).json({
    success: true,
    token,
    data: { user },
  });
};

// ─────────────────────────────────────────────
// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
// ─────────────────────────────────────────────
const register = async (req, res, next) => {
  try {
    const { name, email, password, role, phone, referral_code } = req.body;

    // 1. Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }

    // 2. Handle referral (find referrer by code)
    let referredByUser = null;
    if (referral_code) {
      referredByUser = await User.findOne({ referral_code });
    }

    // 3. Only allow valid roles during registration (no direct admin creation)
    const allowedRoles = ['customer', 'vendor', 'logistics'];
    const userRole = allowedRoles.includes(role) ? role : 'customer';

    // 4. Create user
    const user = await User.create({
      name,
      email,
      password,
      phone,
      role: userRole,
      referred_by: referredByUser ? referredByUser._id : null,
    });

    // 5. Generate and save referral code for new user
    user.referral_code = user.generateReferralCode();
    await user.save({ validateBeforeSave: false });

    // 6. Optionally reward referrer with loyalty points
    if (referredByUser) {
      referredByUser.loyalty_points += 100;
      await referredByUser.save({ validateBeforeSave: false });
    }

    sendTokenResponse(user, 201, res);
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   POST /api/auth/login
// @desc    Authenticate user and return token
// @access  Public
// ─────────────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1. Validate inputs
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.',
      });
    }

    // 2. Find user and explicitly include password for comparison
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // 3. Check if account is active
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Contact support.',
      });
    }

    // 4. Compare entered password with hashed password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // 5. Check if 2FA is enabled
    if (user.two_factor_enabled) {
      return res.status(200).json({
        success: true,
        two_factor_required: true,
        message: 'Please provide your 2FA token to complete login.',
        data: { userId: user._id }
      });
    }

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   POST /api/auth/verify-2fa
// @desc    Complete login by verifying 2FA token
// @access  Public
// ─────────────────────────────────────────────
const verify2FALogin = async (req, res, next) => {
  try {
    const { userId, token } = req.body;

    if (!userId || !token) {
      return res.status(400).json({
        success: false,
        message: 'Please provide user ID and 2FA token.',
      });
    }

    const user = await User.findById(userId).select('+two_factor_secret');

    if (!user || !user.two_factor_enabled) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request or 2FA not enabled.',
      });
    }

    const authenticator = await getAuthenticator();
    const isValid = authenticator.check(token, user.two_factor_secret);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid 2FA token.',
      });
    }

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/auth/me
// @desc    Get current logged-in user profile
// @access  Private (requires JWT)
// ─────────────────────────────────────────────
const getMe = async (req, res, next) => {
  try {
    // req.user is set by the protect middleware
    const user = await User.findById(req.user._id);

    res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   PATCH /api/auth/update-profile
// @desc    Update logged-in user's profile
// @access  Private
// ─────────────────────────────────────────────
const updateProfile = async (req, res, next) => {
  try {
    const allowedFields = ['name', 'phone', 'avatar', 'address'];
    const updates = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,           // return updated document
      runValidators: true, // run schema validators on update
    });

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   PATCH /api/auth/change-password
// @desc    Change logged-in user's password
// @access  Private
// ─────────────────────────────────────────────
const changePassword = async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide current and new password.',
      });
    }

    // Fetch user with password
    const user = await User.findById(req.user._id).select('+password');

    // Verify current password
    const isMatch = await user.comparePassword(current_password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect.',
      });
    }

    user.password = new_password;
    await user.save();

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/auth/users/:id
// @desc    Get public profile of any user (for chat/store context)
// @access  Private
// ─────────────────────────────────────────────
const getUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    let user = await User.findById(id).select('name avatar role');

    // If ID isn't a direct User ID, try resolving it as a Vendor ID (e.g. from Cart/Product pages)
    if (!user) {
      const vendor = await require('../models/Vendor.model').findById(id);
      if (vendor) {
        user = await User.findById(vendor.user_id).select('name avatar role');
        if (user) {
          user = user.toObject();
          user.name = vendor.store_name; // Adopt the store name in chat context
        }
      }
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    res.status(200).json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, verify2FALogin, getMe, getUser, updateProfile, changePassword };
