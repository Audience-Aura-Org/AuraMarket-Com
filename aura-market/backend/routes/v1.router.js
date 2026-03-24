const express = require('express');
const router = express.Router();
const { strictLimiter, publicLimiter } = require('../middleware/rateLimiter');

// Import all routes
const authRoutes = require('./auth.routes');
const cartRoutes = require('./cart.routes');
const vendorRoutes = require('./vendor.routes');
const productRoutes = require('./product.routes');
const orderRoutes = require('./order.routes');
const walletRoutes = require('./wallet.routes');
const escrowRoutes = require('./escrow.routes');
const chatRoutes = require('./chat.routes');
const logisticsRoutes = require('./logistics.routes');
const adminRoutes = require('./admin.routes');
const uploadRoutes = require('./upload.routes');
const usersRoutes = require('./users.routes');
const addressRoutes = require('./address.routes');
const notificationRoutes = require('./notification.routes');
const securityRoutes = require('./security.routes');
const disputeRoutes = require('./dispute.routes');
const reportRoutes = require('./report.routes');
const paymentRoutes = require('./payment.routes');
const couponRoutes = require('./coupon.routes');
const reviewRoutes = require('./review.routes');
const wishlistRoutes = require('./wishlist.routes');
const qaRoutes = require('./qa.routes');
const legalRoutes = require('./legal.routes');
const categoryRoutes = require('./category.routes');
const debugRoutes = require('./debug.routes');
const homepageRoutes = require('./homepage.routes');
const discoveryRoutes = require('./discovery.routes');
const trackingRoutes = require('./tracking.routes');

// Mount routes
router.use('/auth', strictLimiter, authRoutes);
router.use('/cart', cartRoutes);
router.use('/vendors', publicLimiter, vendorRoutes);
router.use('/vendor', vendorRoutes); 
router.use('/products', publicLimiter, productRoutes);
router.use('/orders', orderRoutes);
router.use('/wallet', strictLimiter, walletRoutes);
router.use('/escrow', escrowRoutes);
router.use('/chat', chatRoutes);
router.use('/logistics', logisticsRoutes);
router.use('/admin', adminRoutes);
router.use('/upload', uploadRoutes);
router.use('/users', usersRoutes);
router.use('/addresses', addressRoutes);
router.use('/notifications', notificationRoutes);
router.use('/security', securityRoutes);
router.use('/disputes', disputeRoutes);
router.use('/reports', reportRoutes);
router.use('/payments', paymentRoutes);
router.use('/coupons', couponRoutes);
router.use('/reviews', reviewRoutes);
router.use('/wishlist', wishlistRoutes);
router.use('/qa', qaRoutes);
router.use('/legal', legalRoutes);
router.use('/categories', publicLimiter, categoryRoutes);
router.use('/homepage', homepageRoutes);
router.use('/discovery', publicLimiter, discoveryRoutes);
router.use('/track', trackingRoutes);
// Dev/debug routes (safe to mount locally)
router.use('/debug', debugRoutes);

module.exports = router;
