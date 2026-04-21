const User = require('../models/User.model');
const KYC = require('../models/KYC.model');
const Vendor = require('../models/Vendor.model');
const Follow = require('../models/Follow.model');

const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate('liked_categories').lean();
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
      if (req.body.branding.logo !== undefined) {
        updates['branding.logo'] = req.body.branding.logo || null;
        // Keep avatar in sync for legacy compatibility
        updates.avatar = req.body.branding.logo || null;
      }
      if (req.body.branding.banner !== undefined) {
        updates['branding.banner'] = req.body.branding.banner || null;
      }
    }
    if (req.body?.name !== undefined) updates.name = req.body.name;
    if (req.body?.phone !== undefined) updates.phone = req.body.phone;
    if (req.body?.avatar !== undefined) {
        updates.avatar = req.body.avatar || null;
        // If avatar is explicitly sent, also sync logo
        if (!updates['branding.logo']) updates['branding.logo'] = req.body.avatar || null;
    }
    if (req.body?.onboarding_location !== undefined) updates.onboarding_location = req.body.onboarding_location;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields provided.' });
    }

    const user = await User.findByIdAndUpdate(req.user._id, { $set: updates }, {
      returnDocument: 'after',
      runValidators: true,
    });

    // Cascading updates for role-specific records
    if (user.role === 'vendor') {
      const Store = require('../models/Store.model');
      const storeUpdates = {};
      if (updates['branding.logo'] !== undefined) storeUpdates.logo = updates['branding.logo'];
      if (updates['branding.banner'] !== undefined) storeUpdates.banner = updates['branding.banner'];
      
      if (Object.keys(storeUpdates).length > 0) {
        await Store.findOneAndUpdate({ vendor_id: (await Vendor.findOne({ user_id: user._id }))?._id }, storeUpdates);
      }
      
      if (updates.phone) {
        await Vendor.findOneAndUpdate({ user_id: user._id }, { phone: updates.phone });
      }
    } else if (user.role === 'logistics') {
      const LogisticsCompany = require('../models/LogisticsCompany.model');
      const firmUpdates = {};
      if (updates['branding.logo'] !== undefined) firmUpdates.logo = updates['branding.logo'];
      if (updates['branding.banner'] !== undefined) firmUpdates.banner = updates['branding.banner'];
      
      if (Object.keys(firmUpdates).length > 0) {
        await LogisticsCompany.findOneAndUpdate({ user_id: user._id }, firmUpdates);
      }

      if (updates.phone) {
        await LogisticsCompany.findOneAndUpdate({ user_id: user._id }, { contact_phone: updates.phone });
      }
    }

    return res.status(200).json({ success: true, message: 'Account records synchronized.', data: { user } });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/users/kyc
const submitKYC = async (req, res, next) => {
  try {
    const { full_name, id_type, id_number, file_url_front, file_url_back } = req.body;
    if (!full_name || !id_type || !id_number || !file_url_front) {
      return res.status(400).json({ success: false, message: 'Front-of-ID and legal identifiers are required.' });
    }
    const vendor = await Vendor.findOne({ user_id: req.user._id });
    const kyc = await KYC.findOneAndUpdate(
      { user_id: req.user._id },
      { 
        full_name, 
        document_type: id_type, 
        document_number: id_number, 
        document_front_url: file_url_front, 
        document_back_url: file_url_back || null,
        status: 'pending', 
        vendor_id: vendor ? vendor._id : null 
      },
      { upsert: true, returnDocument: 'after', runValidators: true }
    );
    const user = await User.findByIdAndUpdate(req.user._id, { verification_status: 'pending' }, { returnDocument: 'after' });
    res.status(200).json({ success: true, message: 'KYC submission received node-side. Governance review scheduled.', data: { kyc, user } });
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
      .sort('-createdAt')
      .lean();
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
    const { liked_categories, location, phone } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { liked_categories, onboarding_location: location, phone, onboarded: true },
      { returnDocument: 'after', runValidators: true }
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
