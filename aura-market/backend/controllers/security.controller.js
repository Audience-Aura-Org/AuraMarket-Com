const qrcode = require('qrcode');
const User = require('../models/User.model');

let otplibAuthenticator;
const getAuthenticator = async () => {
  if (!otplibAuthenticator) {
    const otplib = await import('otplib');
    otplibAuthenticator = otplib.authenticator;
  }
  return otplibAuthenticator;
};

/**
 * controllers/security.controller.js
 * Handles Two-Factor Authentication (2FA) setup and management.
 */

// ─────────────────────────────────────────────
// @route   GET /api/security/2fa/generate
// @desc    Generate a 2FA secret and QR code for the user
// @access  Private
// ─────────────────────────────────────────────
const generate2FA = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    // Generate a new secret
    const authenticator = await getAuthenticator();
    const secret = authenticator.generateSecret();
    
    // Save temporary secret to user (not enabled yet)
    // We update secret even if already has one, but only 'enable' after verification
    user.two_factor_secret = secret;
    await user.save({ validateBeforeSave: false });

    // Generate otpauth URL for Google Authenticator/Authy
    const otpauth = authenticator.keyuri(user.email, 'Aura Market', secret);
    
    // Convert to QR code image (Data URL)
    const qrCodeImage = await qrcode.toDataURL(otpauth);

    res.status(200).json({
      success: true,
      data: {
        secret,
        qrCode: qrCodeImage
      }
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   POST /api/security/2fa/enable
// @desc    Verify TOTP token and enable 2FA
// @access  Private
// ─────────────────────────────────────────────
const enable2FA = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: 'TOTP token is required.' });
    }

    const user = await User.findById(req.user._id).select('+two_factor_secret');

    // Verify the token against the saved secret
    const authenticator = await getAuthenticator();
    const isValid = authenticator.check(token, user.two_factor_secret);

    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid token. Please try again.' });
    }

    // Enable 2FA permanently
    user.two_factor_enabled = true;
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: 'Two-Factor Authentication has been enabled successfully.'
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   POST /api/security/2fa/disable
// @desc    Disable 2FA
// @access  Private
// ─────────────────────────────────────────────
const disable2FA = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: 'TOTP token is required to disable 2FA.' });
    }

    const user = await User.findById(req.user._id).select('+two_factor_secret');

    // Verify one last time before disabling
    const authenticator = await getAuthenticator();
    const isValid = authenticator.check(token, user.two_factor_secret);

    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid token. Security verification failed.' });
    }

    user.two_factor_enabled = false;
    user.two_factor_secret = undefined;
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: 'Two-Factor Authentication has been disabled.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  generate2FA,
  enable2FA,
  disable2FA
};
