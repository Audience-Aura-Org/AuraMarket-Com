const User = require('../models/User.model');
const KYC = require('../models/KYC.model');
const Vendor = require('../models/Vendor.model');
const Follow = require('../models/Follow.model');

const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate('liked_categories');
    res.status(200).json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/v1/users/me
// Persist per-user branding (logo/banner) across devices.
const updateMe = async (req, res, next) => {
  try {
    const updates = {};
    if (req.body?.branding && typeof req.body.branding === 'object') {
      updates.branding = {};
      if (req.body.branding.logo !== undefined) updates.branding.logo = req.body.branding.logo || null;
      if (req.body.branding.banner !== undefined) updates.branding.banner = req.body.branding.banner || null;
    }
    if (req.body?.name !== undefined) updates.name = req.body.name;
    if (req.body?.phone !== undefined) updates.phone = req.body.phone;
    if (req.body?.avatar !== undefined) updates.avatar = req.body.avatar || null;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields provided.' });
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    });

    return res.status(200).json({ success: true, message: 'Account updated successfully.', data: { user } });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/users/kyc
const submitKYC = async (req, res, next) => {
  try {
    const { full_name, id_type, id_number, file_url } = req.body;
    if (!full_name || !id_type || !id_number || !file_url) {
      return res.status(400).json({ success: false, message: 'All KYC fields are required.' });
    }
    const vendor = await Vendor.findOne({ user_id: req.user._id });
    const kyc = await KYC.findOneAndUpdate(
      { user_id: req.user._id },
      { full_name, document_type: id_type, document_number: id_number, document_front_url: file_url, status: 'pending', vendor_id: vendor ? vendor._id : null },
      { upsert: true, new: true, runValidators: true }
    );
    const user = await User.findByIdAndUpdate(req.user._id, { verification_status: 'pending' }, { new: true });
    res.status(200).json({ success: true, message: 'KYC submission received.', data: { kyc, user } });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/users/followed-vendors
const getFollowedVendors = async (req, res, next) => {
  try {
    const follows = await Follow.find({ user_id: req.user._id })
      .populate({
        path: 'vendor_id',
        select: 'store_name description rating verified follower_count user_id',
        populate: { path: 'user_id', select: 'avatar branding' }
      })
      .sort('-createdAt');
    res.status(200).json({ success: true, count: follows.length, data: { follows } });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/users/onboarding
 * @desc    Finalize user onboarding with categories and location
 * @access  Private
 */
const completeOnboarding = async (req, res, next) => {
  try {
    const { liked_categories, location } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { liked_categories, onboarding_location: location, onboarded: true },
      { new: true, runValidators: true }
    );
    res.status(200).json({ success: true, message: 'Onboarding finalized. Welcome to the Hub.', data: { user } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMe,
  updateMe,
  submitKYC,
  getFollowedVendors,
  completeOnboarding
};
