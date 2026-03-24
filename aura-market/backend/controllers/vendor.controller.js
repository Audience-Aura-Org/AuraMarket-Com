/**
 * controllers/vendor.controller.js
 * Aura Market — Vendor & Store Management Controller
 *
 * Provides endpoints for users with 'vendor' roles to manage their profile
 * and their specialized shop representation (Store).
 */

const Vendor = require('../models/Vendor.model');
const Store = require('../models/Store.model');
const KYC = require('../models/KYC.model');
const Escrow = require('../models/Escrow.model');
const mongoose = require('mongoose');
const Follow = require('../models/Follow.model');

// ─────────────────────────────────────────────
// @route   POST /api/vendors/onboard
// @desc    Register a logged-in User as a Vendor (Creates both Vendor & Store)
// @access  Private (Role: vendor)
// ─────────────────────────────────────────────
const onboardVendor = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { store_name, description, categories, phone, location } = req.body;

    // 1. Check if vendor profile already exists for this user (WITHIN SESSION)
    let vendor = await Vendor.findOne({ user_id: req.user._id }).session(session);
    let store;

    if (vendor) {
      console.log(`[ONBOARD] Updating existing vendor: ${vendor._id}`);
      // Update existing profile (idempotent onboarding)
      vendor.store_name = store_name || vendor.store_name;
      vendor.description = description || vendor.description;
      vendor.phone = phone || req.user.phone || vendor.phone || '000000000';
      
      if (location) {
        vendor.pickup_address = {
          city: location.city || vendor.pickup_address?.city,
          quartier: location.quartier || vendor.pickup_address?.quartier,
          street: location.address_description || vendor.pickup_address?.street,
          region: vendor.pickup_address?.region
        };
      }
      
      vendor.is_onboarded = true;
      vendor.onboarding_step = 'complete';
      await vendor.save({ session });

      store = await Store.findOne({ vendor_id: vendor._id }).session(session);
      if (store) {
        store.categories = categories || store.categories;
        await store.save({ session });
      } else {
        const storeArray = await Store.create(
          [{ vendor_id: vendor._id, categories: categories || [] }],
          { session }
        );
        store = storeArray[0];
      }
    } else {
      console.log(`[ONBOARD] Creating new vendor for user: ${req.user._id}`);
      // 2. Create the Vendor profile (new)
      const vendorArray = await Vendor.create(
        [
          {
            user_id: req.user._id,
            store_name,
            description,
            phone: phone || req.user.phone || '000000000',
            pickup_address: location ? {
              city: location.city,
              quartier: location.quartier,
              street: location.address_description
            } : {},
            is_onboarded: true,
            onboarding_step: 'complete'
          },
        ],
        { session }
      );
      vendor = vendorArray[0];

      // 3. Create the Store associated with the new Vendor
      const storeArray = await Store.create(
        [
          {
            vendor_id: vendor._id,
            categories: categories || [],
          },
        ],
        { session }
      );
      store = storeArray[0];
    }

    // 4. Force mark user as onboarded (ensure persistence)
    const User = require('../models/User.model');
    await User.findByIdAndUpdate(req.user._id, { onboarded: true }, { session });

    // Commit Transaction
    await session.commitTransaction();
    session.endSession();

    // Fetch updated user to return
    const updatedUser = await User.findById(req.user._id);

    res.status(200).json({
      success: true,
      message: 'Vendor and Store synchronized successfully.',
      data: {
        vendor,
        store,
        user: updatedUser
      },
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    session.endSession();
    console.error('[ONBOARD_ERROR]', error);
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/vendors/me
// @desc    Get the current logged-in vendor & their store details
// @access  Private (Role: vendor)
// ─────────────────────────────────────────────
const getVendorProfile = async (req, res, next) => {
  try {
    // Populate store and specific user fields
    const vendor = await Vendor.findById(req.vendor._id)
      .populate('store')
      .populate('user_id', 'branding avatar');

    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor profile not found.' });
    }

    // Calculate pending escrow balance
    const escrowStats = await Escrow.aggregate([
      { $match: { vendor_id: vendor._id, status: 'held' } },
      { $group: { _id: null, totalHeld: { $sum: '$amount' } } }
    ]);
    const escrowBalance = escrowStats.length > 0 ? escrowStats[0].totalHeld : 0;

    res.status(200).json({
      success: true,
      data: { 
        vendor,
        escrow_balance: escrowBalance 
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   PATCH /api/vendors/store
// @desc    Update store visuals (logo, banner, categories)
// @access  Private (Role: vendor)
// ─────────────────────────────────────────────
const updateStore = async (req, res, next) => {
  try {
    const vendor = req.vendor;

    const allowedUpdates = ['banner', 'logo', 'categories'];
    const updateData = {};

    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    const store = await Store.findOneAndUpdate(
      { vendor_id: vendor._id },
      updateData,
      { new: true, runValidators: true }
    );

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found.',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Store updated successfully.',
      data: { store },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   PATCH /api/vendors/profile
// @desc    Update vendor profile (store_name, description)
// @access  Private (Role: vendor)
// ─────────────────────────────────────────────
const updateVendorProfile = async (req, res, next) => {
  try {
    const { store_name, description } = req.body;
    const vendor = await Vendor.findByIdAndUpdate(
      req.vendor._id,
      { store_name, description },
      { new: true, runValidators: true }
    );

    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor profile not found.' });
    }

    res.status(200).json({
      success: true,
      message: 'Vendor profile updated successfully.',
      data: { vendor },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/vendors
// @desc    Get all public Vendor Stores (Discovery Feed base endpoint)
// @access  Public
// ─────────────────────────────────────────────
const getPublicStores = async (req, res, next) => {
  try {
    const { search } = req.query;
    let query = {};

    if (search) {
      query.store_name = { $regex: search, $options: 'i' };
    }

    // We fetch base Vendors and populate their Stores
    // Used for store directories and discovery feeds
    const stores = await Vendor.find(query)
      .select('store_name rating verified description user_id follower_count')
      .populate('store', 'logo banner categories') // only fetch visible assets
      .populate('user_id', 'branding avatar') // fetch user-level branding for fallbacks
      .limit(20); 

    res.status(200).json({
      success: true,
      count: stores.length,
      data: { stores },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/vendors/stores/:id
// @desc    Get a single Store's public profile by its Vendor ID
// @access  Public
// ─────────────────────────────────────────────
const getStore = async (req, res, next) => {
  try {
    const store = await Store.findOne({ vendor_id: req.params.id })
      .populate({
        path: 'vendor_id',
        select: 'store_name description rating verified user_id follower_count',
        populate: { path: 'user_id', select: 'branding avatar' }
      });

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found.',
      });
    }

    res.status(200).json({
      success: true,
      data: { store },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   POST /api/vendors/kyc
// @desc    Submit KYC documents for identity verification
// @access  Private (Role: vendor)
// ─────────────────────────────────────────────
const submitKYC = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ user_id: req.user._id });
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor profile not found.' });
    }

    const { 
      document_type, 
      document_number, 
      document_front_url, 
      document_back_url, 
      selfie_url 
    } = req.body;

    // Check if KYC already submitted
    let kyc = await KYC.findOne({ user_id: req.user._id });

    if (kyc && kyc.status === 'approved') {
      return res.status(400).json({ success: false, message: 'Your identity is already verified.' });
    }

    if (kyc) {
      // Update existing if pending or rejected
      kyc.document_type = document_type;
      kyc.document_number = document_number;
      kyc.document_front_url = document_front_url;
      kyc.document_back_url = document_back_url;
      kyc.selfie_url = selfie_url;
      kyc.status = 'pending'; // Reset to pending if it was rejected
      await kyc.save();
    } else {
      kyc = await KYC.create({
        user_id: req.user._id,
        vendor_id: vendor._id,
        document_type,
        document_number,
        document_front_url,
        document_back_url,
        selfie_url
      });
    }

    res.status(200).json({
      success: true,
      message: 'KYC documents submitted successfully. Admin review pending.',
      data: { kyc }
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   POST /api/vendors/:id/follow
// @desc    Follow a vendor
// @access  Private (Authenticated)
// ─────────────────────────────────────────────
const followVendor = async (req, res, next) => {
  try {
    const vendorId = req.params.id;
    const userId = req.user._id;

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor node not found.' });

    // Check if already following
    const existing = await Follow.findOne({ user_id: userId, vendor_id: vendorId });
    if (existing) return res.status(400).json({ success: false, message: 'Already connected to this node.' });

    await Follow.create({ user_id: userId, vendor_id: vendorId });
    
    // Atomically increment follower count
    vendor.follower_count = (vendor.follower_count || 0) + 1;
    await vendor.save();

    res.status(201).json({ success: true, message: `Now following ${vendor.store_name}.`, follower_count: vendor.follower_count });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   DELETE /api/vendors/:id/follow
// @desc    Unfollow a vendor
// @access  Private (Authenticated)
// ─────────────────────────────────────────────
const unfollowVendor = async (req, res, next) => {
  try {
    const vendorId = req.params.id;
    const userId = req.user._id;

    const follow = await Follow.findOneAndDelete({ user_id: userId, vendor_id: vendorId });
    if (!follow) return res.status(400).json({ success: false, message: 'Relation not found mapping.' });

    const vendor = await Vendor.findById(vendorId);
    if (vendor) {
      vendor.follower_count = Math.max(0, (vendor.follower_count || 0) - 1);
      await vendor.save();
    }

    res.status(200).json({ success: true, message: 'Unfollowed successfully.', follower_count: vendor?.follower_count || 0 });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/vendors/:id/followers
// @desc    Get all followers for a specific vendor
// @access  Private (Role: vendor - only own followers, or admin)
// ─────────────────────────────────────────────
const getFollowers = async (req, res, next) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found.' });

    // Ensure vendor only sees their own followers (unless admin)
    if (req.user.role !== 'admin' && vendor.user_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized access to node manifest.' });
    }

    const followers = await Follow.find({ vendor_id: vendor._id })
      .populate('user_id', 'name email avatar branding')
      .sort('-createdAt');

    res.status(200).json({ success: true, count: followers.length, data: { followers } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/vendors/:id/follow-status
// @desc    Check if current user follows a vendor
// @access  Private (Authenticated)
// ─────────────────────────────────────────────
const checkFollowStatus = async (req, res, next) => {
  try {
    const follow = await Follow.findOne({ user_id: req.user._id, vendor_id: req.params.id });
    res.status(200).json({ success: true, is_following: !!follow });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  onboardVendor,
  getVendorProfile,
  updateStore,
  updateVendorProfile,
  getPublicStores,
  getStore,
  submitKYC,
  followVendor,
  unfollowVendor,
  getFollowers,
  checkFollowStatus,
};
