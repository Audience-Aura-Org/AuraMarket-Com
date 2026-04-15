const Review = require('../models/Review.model');
const Product = require('../models/Product.model');
const Order = require('../models/Order.model');

/**
 * controllers/review.controller.js
 * Logic for submitting and fetching product reviews.
 */

// @route   POST /api/reviews
// @desc    Submit a review for a product
// @access  Private (Verified Buyers)
const submitReview = async (req, res, next) => {
  try {
    const { product_id, order_id, rating, comment, images } = req.body;

    // 1. Verify that the user actually bought the product in this order
    const order = await Order.findOne({
      _id: order_id,
      customer_id: req.user._id,
      order_status: 'completed',
      'products.product_id': product_id
    });

    if (!order) {
      return res.status(403).json({
        success: false,
        message: 'You can only review products from completed orders you have purchased.'
      });
    }

    // 2. Create the review
    const review = await Review.create({
      user_id: req.user._id,
      product_id,
      order_id,
      rating,
      comment,
      images
    });

    // 3. Recalculate average rating for the product
    const reviews = await Review.find({ product_id });
    const numReviews = reviews.length;
    const avgRating = reviews.reduce((acc, item) => item.rating + acc, 0) / numReviews;

    await Product.findByIdAndUpdate(product_id, {
      rating: parseFloat(avgRating.toFixed(1)),
      num_reviews: numReviews
    });

    res.status(201).json({ success: true, data: { review } });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'You have already reviewed this item for this order.' });
    }
    next(error);
  }
};

// @route   GET /api/reviews/product/:id
// @desc    Get all reviews for a product
// @access  Public
const getProductReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find({ product_id: req.params.id })
      .populate('user_id', 'name avatar')
      .sort('-createdAt');

    res.status(200).json({ success: true, count: reviews.length, data: { reviews } });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/reviews/vendor
// @desc    Get all reviews for products owned by the vendor
// @access  Private (Vendor)
const getVendorReviews = async (req, res, next) => {
  try {
    if (!req.vendor) {
      return res.status(403).json({ success: false, message: 'Vendor access required.' });
    }

    // 1. Get all products owned by the vendor
    const products = await Product.find({ vendor_id: req.vendor._id }).select('_id');
    const productIds = products.map(p => p._id);

    // 2. Fetch all reviews tied to those products
    const reviews = await Review.find({ product_id: { $in: productIds } })
      .populate('user_id', 'name avatar')
      .populate('product_id', 'name images')
      .sort('-createdAt');

    res.status(200).json({ success: true, count: reviews.length, data: { reviews } });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/reviews/admin
// @desc    Get all reviews for admin management
// @access  Private (Admin)
const getAllReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find()
      .populate('user_id', 'name email avatar')
      .populate('product_id', 'name images vendor_id')
      .sort('-createdAt');

    res.status(200).json({ success: true, count: reviews.length, data: { reviews } });
  } catch (error) {
    next(error);
  }
};

// @route   DELETE /api/reviews/:id
// @desc    Delete a review (Admin only)
// @access  Private (Admin)
const deleteReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found.' });
    }

    // Capture product_id before deletion to recalculate stats
    const { product_id } = review;

    await Review.findByIdAndDelete(req.params.id);

    // Recalculate average rating for the product
    const reviews = await Review.find({ product_id });
    const numReviews = reviews.length;
    let avgRating = 0;
    
    if (numReviews > 0) {
      avgRating = reviews.reduce((acc, item) => item.rating + acc, 0) / numReviews;
    }

    await Product.findByIdAndUpdate(product_id, {
      rating: parseFloat(avgRating.toFixed(1)),
      num_reviews: numReviews
    });

    res.status(200).json({ success: true, message: 'Review deleted and ratings recalculated.' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  submitReview,
  getProductReviews,
  getVendorReviews,
  getAllReviews,
  deleteReview
};
