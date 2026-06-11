/**
 * controllers/auth.controller.js
 * Auradime — Authentication Controller
 *
 * register() → create a new user account
 * login()    → authenticate and return JWT
 * getMe()    → return the current logged-in user
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User.model');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/env');
const { normalizeUserMedia } = require('../utils/media');
const AuthOtp = require('../models/AuthOtp.model');
const {
  clearAuthCookie,
  createAuthToken,
  createSignupToken,
  normalizeEmail,
  sendOtpToEmail,
  setAuthCookie,
  verifyOtpForEmail,
  verifySignupToken,
} = require('../services/authOtp.service');

const SUPPORT_ADMIN_EMAIL = 'support@auradime.com';

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
  return jwt.sign({ id, type: 'auth' }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// ─────────────────────────────────────────────
// Helper: Send token response
// ─────────────────────────────────────────────
const sendTokenResponse = (user, statusCode, res) => {
  const token = createAuthToken(user);
  setAuthCookie(res, token);

  // Remove password from output (extra safety)
  const userObj = (user && typeof user.toObject === 'function') ? user.toObject() : { ...user };
  if (userObj.password) userObj.password = undefined;
  normalizeUserMedia(userObj);

  res.status(statusCode).json({
    success: true,
    token,
    data: { user: userObj },
  });
};

const buildSafeUser = (user) => {
  const userObj = (user && typeof user.toObject === 'function') ? user.toObject() : { ...user };
  delete userObj.password;
  delete userObj.token_version;
  normalizeUserMedia(userObj);
  return userObj;
};

const isSupportAdminEmail = (email) => normalizeEmail(email || '') === SUPPORT_ADMIN_EMAIL;

const ensureSupportAdmin = async (user) => {
  if (!user || !isSupportAdminEmail(user.email)) return user;
  if (user.role === 'admin' && user.onboarded === true && user.is_active === true) return user;

  user.role = 'admin';
  user.onboarded = true;
  user.is_active = true;
  user.verification_status = user.verification_status === 'verified'
    ? user.verification_status
    : 'verified';
  await user.save({ validateBeforeSave: false });
  return user;
};

const cleanText = (value, max = 120) => String(value || '').trim().slice(0, max);

const cleanPhone = (value) => String(value || '').replace(/[\s()-]/g, '').trim().slice(0, 20);

const sendOtp = async (req, res, next) => {
  try {
    const result = await sendOtpToEmail(req.body.email);
    res.status(200).json({
      success: true,
      message: 'Verification code sent.',
      data: result,
    });
  } catch (error) {
    if (error.retryAfter) res.set('Retry-After', String(error.retryAfter));
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Unable to send verification code.',
      retryAfter: error.retryAfter,
    });
  }
};

const createUserFromSignup = async ({ email, name, role, phone, referral_code }) => {
  const allowedRoles = ['customer', 'vendor', 'logistics'];
  const userRole = isSupportAdminEmail(email)
    ? 'admin'
    : allowedRoles.includes(role) ? role : 'customer';
  const normalizedPhone = cleanPhone(phone);

  let referredByUser = null;
  if (referral_code) {
    referredByUser = await User.findOne({ referral_code });
  }

  if (userRole !== 'admin' && !normalizedPhone) {
    const error = new Error('Phone number is required to complete onboarding.');
    error.statusCode = 400;
    throw error;
  }

  const baseUserPayload = {
    name: userRole === 'admin' ? cleanText(name || 'Auradime Support', 80) : cleanText(name, 80),
    email,
    phone: normalizedPhone,
    role: userRole,
    auth_provider: 'email_otp',
    referred_by: referredByUser ? referredByUser._id : null,
  };

  if (userRole !== 'admin') baseUserPayload.onboarded = false;

  if (userRole === 'admin') {
    baseUserPayload.onboarded = true;
    baseUserPayload.verification_status = 'verified';
    baseUserPayload.is_active = true;
  }

  const user = await User.create(baseUserPayload);

  user.referral_code = user.generateReferralCode();
  await user.save({ validateBeforeSave: false });

  if (referredByUser) {
    referredByUser.loyalty_points += 100;
    await referredByUser.save({ validateBeforeSave: false });
  }

  return user;
};

const verifyOtp = async (req, res, next) => {
  try {
    const { email, otp, signupToken, name, role, phone, referral_code } = req.body;
    let verifiedEmail;

    if (signupToken) {
      verifiedEmail = verifySignupToken(signupToken);
      const existing = await User.findOne({ email: verifiedEmail });
      if (existing) {
        await ensureSupportAdmin(existing);
        return sendTokenResponse(existing, 200, res);
      }
    } else {
      verifiedEmail = await verifyOtpForEmail(email, otp);
    }

    let user = await User.findOne({ email: verifiedEmail });
    if (user) user = await ensureSupportAdmin(user);

    if (!user) {
      if (!isSupportAdminEmail(verifiedEmail) && (!name || String(name).trim().length < 2)) {
        const signupToken = createSignupToken(verifiedEmail);
        return res.status(200).json({
          success: true,
          signup_required: true,
          signupRequired: true,
          signupToken,
          message: 'Email verified. Complete your profile to enter Auradime.',
          data: {
            email: verifiedEmail,
            signup_required: true,
            signupRequired: true,
            signupToken,
          },
        });
      }

      user = await createUserFromSignup({
        email: verifiedEmail,
        name: String(name).trim(),
        role,
        phone,
        referral_code,
      });
      user = await ensureSupportAdmin(user);
    }

    await AuthOtp.deleteOne({ email: verifiedEmail });
    return sendTokenResponse(user, user.createdAt && Date.now() - user.createdAt.getTime() < 30000 ? 201 : 200, res);
  } catch (error) {
    if (error.retryAfter) res.set('Retry-After', String(error.retryAfter));
    res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || 'Unable to verify code.',
      retryAfter: error.retryAfter,
    });
  }
};

const deleteAccount = async (req, res, next) => {
  try {
    const { confirmText } = req.body;
    if (!['DELETE', 'SUPPRIMER'].includes(String(confirmText || '').trim().toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: 'Type DELETE or SUPPRIMER to permanently delete your account.',
      });
    }

    const user = await User.findById(req.user._id).select('+token_version');
    if (!user) {
      clearAuthCookie(res);
      return res.status(200).json({ success: true, message: 'Account already deleted.' });
    }

    user.token_version = Number(user.token_version || 0) + 1;
    user.is_active = false;
    await user.save({ validateBeforeSave: false });

    const userId = user._id;
    const Vendor = require('../models/Vendor.model');
    const Product = require('../models/Product.model');
    const Store = require('../models/Store.model');
    const LogisticsCompany = require('../models/LogisticsCompany.model');

    const vendor = await Vendor.findOne({ user_id: userId });
    const vendorId = vendor?._id;

    const deletions = [
      AuthOtp.deleteMany({ email: user.email }),
      require('../models/Cart.model').deleteMany({ user_id: userId }),
      require('../models/Wishlist.model').deleteMany({ user_id: userId }),
      require('../models/Notification.model').deleteMany({ recipient: userId }),
      require('../models/PushSubscription.model').deleteMany({ user_id: userId }),
      require('../models/Message.model').deleteMany({ $or: [{ sender_id: userId }, { receiver_id: userId }] }),
      require('../models/Follow.model').deleteMany({ user_id: userId }),
      require('../models/RecentlyViewed.model').deleteMany({ user_id: userId }),
      require('../models/StockWatch.model').deleteMany({ user_id: userId }),
      require('../models/KYC.model').deleteMany({ user_id: userId }),
      require('../models/UserActivity.model').deleteMany({ user_id: userId }),
      require('../models/Question.model').deleteMany({ user_id: userId }),
      require('../models/Review.model').deleteMany({ user_id: userId }),
      require('../models/Transaction.model').deleteMany({ user_id: userId }),
      require('../models/WithdrawalRequest.model').deleteMany({ requestedBy: userId }),
      require('../models/Order.model').deleteMany({ customer_id: userId }),
      require('../models/RefundRequest.model').deleteMany({ customer_id: userId }),
    ];

    if (vendorId) {
      deletions.push(
        Product.deleteMany({ vendor_id: vendorId }),
        Store.deleteMany({ vendor_id: vendorId }),
        require('../models/Follow.model').deleteMany({ vendor_id: vendorId }),
        require('../models/KYC.model').deleteMany({ vendor_id: vendorId }),
        require('../models/Order.model').deleteMany({ vendor_id: vendorId }),
        require('../models/RefundRequest.model').deleteMany({ vendor_id: vendorId }),
        Vendor.findByIdAndDelete(vendorId)
      );
    }

    if (user.role === 'logistics') {
      deletions.push(LogisticsCompany.deleteMany({ user_id: userId }));
    }

    await Promise.all(deletions);
    req.app.get('io')?.to(userId.toString()).emit('account_deleted', { reason: 'self_deleted' });
    await User.findByIdAndDelete(userId);
    clearAuthCookie(res);

    res.status(200).json({
      success: true,
      message: 'Account deleted permanently.',
    });
  } catch (error) {
    next(error);
  }
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
    let user = await User.findById(req.user._id);
    if (user) user = await ensureSupportAdmin(user);
    const userObj = user ? (typeof user.toObject === 'function' ? user.toObject() : user) : null;
    normalizeUserMedia(userObj);

    res.status(200).json({ success: true, data: { user: userObj } });
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
    const allowedFields = ['name', 'phone', 'avatar', 'address', 'branding'];
    const updates = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      returnDocument: 'after',           // return updated document
      runValidators: true, // run schema validators on update
    });

    const userObj = user ? (typeof user.toObject === 'function' ? user.toObject() : user) : null;
    normalizeUserMedia(userObj);

    res.status(200).json({ success: true, message: 'Profile updated successfully.', data: { user: userObj } });
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
    let user = await User.findById(id).select('name avatar role branding is_online last_seen');

    // If ID isn't a direct User ID, try resolving it as a Vendor ID (e.g. from Cart/Product pages)
    if (!user) {
      const vendor = await require('../models/Vendor.model').findById(id);
      if (vendor) {
        const VendorStore = await require('../models/Store.model').findOne({ vendor_id: vendor._id });
        user = await User.findById(vendor.user_id).select('name avatar role branding is_online last_seen');
        if (user) {
          user = user.toObject();
          user.name = vendor.store_name; 
          // 🚀 SYNC: If user is discovered as a vendor but User branding is missing, fallback to Store visuals
          if (!user.branding?.logo && VendorStore?.logo) {
            user.branding = { ...user.branding, logo: VendorStore.logo };
          }
          if (!user.branding?.banner && VendorStore?.banner) {
             user.branding = { ...user.branding, banner: VendorStore.banner };
          }
        }
      }
    } else if (user.role === 'vendor') {
       // If we found the user directly but they are a vendor, also try pulling their store name
       const vendor = await require('../models/Vendor.model').findOne({ user_id: user._id });
       if (vendor) {
         user = user.toObject();
         user.name = vendor.store_name;
         // and fallback branding if missing
         const VendorStore = await require('../models/Store.model').findOne({ vendor_id: vendor._id });
         if (!user.branding?.logo && VendorStore?.logo) user.branding = { ...user.branding, logo: VendorStore.logo };
         if (!user.branding?.banner && VendorStore?.banner) user.branding = { ...user.branding, banner: VendorStore.banner };
       }
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    const userObj = user ? (typeof user.toObject === 'function' ? user.toObject() : user) : null;
    normalizeUserMedia(userObj);
    res.status(200).json({ success: true, data: { user: userObj } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/auth/admin-info
// @desc    Get the primary platform admin for support/contact
// @access  Private
// ─────────────────────────────────────────────
const getAdminInfo = async (req, res, next) => {
  try {
    let admin = await User.findOne({ email: SUPPORT_ADMIN_EMAIL }).select('name email avatar role branding onboarded is_active verification_status');
    if (admin) admin = await ensureSupportAdmin(admin);
    if (!admin) admin = await User.findOne({ role: 'admin' }).select('name avatar role branding');
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin node not found.' });
    }
    const adminObj = admin ? (typeof admin.toObject === 'function' ? admin.toObject() : admin) : null;
    normalizeUserMedia(adminObj);
    res.status(200).json({ success: true, data: { admin: adminObj } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  verify2FALogin,
  sendOtp,
  verifyOtp,
  deleteAccount,
  getMe,
  getUser,
  updateProfile,
  changePassword,
  getAdminInfo,
};
