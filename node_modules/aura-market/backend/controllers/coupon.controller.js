const Coupon = require('../models/Coupon.model');

/**
 * controllers/coupon.controller.js
 * Logic for validating and managing promo codes.
 */

// @route   POST /api/coupons/validate
// @desc    Check if a coupon code is valid and return discount details
// @access  Private
const validateCoupon = async (req, res, next) => {
  try {
    const { code, orderAmount, vendorId } = req.body;
    
    const coupon = await Coupon.findOne({ code, is_active: true });
    
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Invalid or inactive coupon code.' });
    }

    if (!coupon.isValid(orderAmount)) {
      return res.status(400).json({ success: false, message: 'Coupon is expired or order total is insufficient.' });
    }

    // If coupon is vendor-specific, check if it matches the current vendor
    if (coupon.vendor_id && vendorId && coupon.vendor_id.toString() !== vendorId) {
      return res.status(400).json({ success: false, message: 'This coupon is not applicable for this vendor.' });
    }

    let discount = 0;
    if (coupon.discount_type === 'fixed') {
      discount = coupon.discount_value;
    } else {
      discount = (orderAmount * coupon.discount_value) / 100;
      if (coupon.max_discount_amount && discount > coupon.max_discount_amount) {
        discount = coupon.max_discount_amount;
      }
    }

    res.status(200).json({
      success: true,
      message: 'Coupon applied successfully.',
      data: {
        code: coupon.code,
        discount_amount: discount,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value
      }
    });
  } catch (error) {
    next(error);
  }
};

// @route   POST /api/coupons
// @desc    Create a new coupon (Admin or Vendor)
// @access  Private
const createCoupon = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'vendor') {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    const couponData = { ...req.body };
    if (req.user.role === 'vendor') {
      // Find the vendor linked to this user
      const Vendor = require('../models/Vendor.model');
      const vendor = await Vendor.findOne({ user_id: req.user._id });
      couponData.vendor_id = vendor._id;
    }

    const coupon = await Coupon.create(couponData);

    // Notify Followers of the promotion
    if (req.user.role === 'vendor') {
       const userVendor = await require('../models/Vendor.model').findOne({ user_id: req.user._id });
       if (userVendor) {
          const { notifyFollowers } = require('../utils/notifier');
          notifyFollowers(req.app, userVendor._id, {
             title: 'New Discount Available!',
             message: `${userVendor.store_name} just released a new promo code: ${coupon.code}. Exclusive to followers!`,
             metadata: { target_id: coupon._id, link: `/stores/${userVendor._id}` }
          });
       }
    }

    res.status(201).json({ success: true, data: { coupon } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  validateCoupon,
  createCoupon
};
