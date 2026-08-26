const Wishlist = require('../models/Wishlist.model');
const Product = require('../models/Product.model');

/**
 * controllers/wishlist.controller.js
 * Logic for managing user wishlists.
 */

// @route   GET /api/wishlist
// @desc    Get current user's wishlist
// @access  Private
const getWishlist = async (req, res, next) => {
  try {
    let wishlist = await Wishlist.findOne({ user_id: req.user._id }).populate({
      path: 'products',
      populate: {
        path: 'vendor_id',
        select: 'store_name rating follower_count is_verified verified user_id',
        populate: {
          path: 'user_id',
          select: 'name avatar branding logo',
        },
      },
    });

    if (!wishlist) {
      wishlist = await Wishlist.create({ user_id: req.user._id, products: [] });
    }

    res.status(200).json({ success: true, data: { wishlist } });
  } catch (error) {
    next(error);
  }
};

// @route   POST /api/wishlist/toggle/:productId
// @desc    Add or remove a product from wishlist
// @access  Private
const toggleWishlist = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const product = await Product.findOne({ _id: productId, status: 'active' }).select('_id').lean();
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found or unavailable.' });
    }
    let wishlist = await Wishlist.findOne({ user_id: req.user._id });

    if (!wishlist) {
      wishlist = await Wishlist.create({ user_id: req.user._id, products: [productId] });
      return res.status(200).json({ success: true, message: 'Added to wishlist.', data: { wishlist, isWishlisted: true } });
    }

    const index = wishlist.products.findIndex((id) => id.toString() === productId.toString());
    let isWishlisted = false;

    if (index === -1) {
      wishlist.products.push(productId);
      isWishlisted = true;
    } else {
      wishlist.products.splice(index, 1);
      isWishlisted = false;
    }

    await wishlist.save();

    res.status(200).json({
      success: true,
      message: isWishlisted ? 'Added to wishlist.' : 'Removed from wishlist.',
      data: { wishlist, isWishlisted }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getWishlist,
  toggleWishlist
};
