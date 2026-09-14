/**
 * controllers/address.controller.js
 * Auradime — User Address Management
 */

const User = require('../models/User.model');
const Vendor = require('../models/Vendor.model');

// ─────────────────────────────────────────────
// @route   GET /api/addresses
// @desc    Get all addresses for logged in user
// @access  Private
// ─────────────────────────────────────────────
const getAddresses = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('addresses role');
    let addresses = user.addresses || [];

    // If user has no saved addresses and is a vendor, fall back to vendor pickup_address
    if (addresses.length === 0 && (user.role === 'vendor' || user.role === 'restaurant')) {
      const vendor = await Vendor.findOne({ user_id: user._id }).select('pickup_address').lean();
      const pa = vendor?.pickup_address;
      if (pa && (pa.city || pa.street || pa.quartier)) {
        addresses = [{
          _id: 'vendor_pickup',
          label: 'Store Pickup',
          street: pa.street || pa.address_description || '',
          city: pa.city || '',
          region: pa.district || pa.region || '',
          quartier: pa.quartier || '',
          zone_id: pa.zone_id || null,
          isDefault: true,
        }];
      }
    }

    res.status(200).json({
      success: true,
      data: { addresses }
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   POST /api/addresses
// @desc    Add a new address
// @access  Private
// ─────────────────────────────────────────────
const addAddress = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    // If this is the first address, make it default
    const isDefault = user.addresses.length === 0 ? true : req.body.isDefault || false;

    // If new address is set to default, unset others
    if (isDefault) {
      user.addresses.forEach(addr => addr.isDefault = false);
    }

    user.addresses.push({
      label: req.body.label,
      street: req.body.street,
      city: req.body.city,
      region: req.body.region,
      quartier: req.body.quartier,
      zone_id: req.body.zone_id || null,
      landmark_description: req.body.landmark_description,
      contact_phone: req.body.contact_phone,
      recipient_name: req.body.recipient_name,
      isDefault
    });

    await user.save();

    res.status(201).json({
      success: true,
      data: { addresses: user.addresses }
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   PATCH /api/addresses/:id
// @desc    Update an address
// @access  Private
// ─────────────────────────────────────────────
const updateAddress = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const address = user.addresses.id(req.params.id);
    const allowedFields = ['label', 'street', 'city', 'region', 'quartier', 'zone_id', 'landmark_description', 'contact_phone', 'recipient_name', 'isDefault'];

    if (!address) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }

    // If setting to default, unset others
    if (req.body.isDefault) {
      user.addresses.forEach(addr => addr.isDefault = false);
    }

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        address[field] = req.body[field];
      }
    }
    await user.save();

    res.status(200).json({
      success: true,
      data: { addresses: user.addresses }
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   DELETE /api/addresses/:id
// @desc    Remove an address
// @access  Private
// ─────────────────────────────────────────────
const deleteAddress = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    
    // Using pull to remove subdocument
    user.addresses.pull(req.params.id);
    
    // If we deleted the default one, pick a new default if any exist
    if (user.addresses.length > 0 && !user.addresses.some(a => a.isDefault)) {
      user.addresses[0].isDefault = true;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Address removed successfully',
      data: { addresses: user.addresses }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress
};
