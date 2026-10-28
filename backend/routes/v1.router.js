const express = require('express');
const router = express.Router();
const { strictLimiter, publicLimiter } = require('../middleware/rateLimiter');
const { cacheResponse } = require('../middleware/cache.middleware');
const { actAs } = require('../middleware/delegate.middleware');

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
const managerRoutes = require('./manager.routes');
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
const pushRoutes = require('./push.routes');
const statusRoutes = require('./status.routes');
const withdrawalRoutes = require('./withdrawal.routes');
const subscriptionRoutes = require('./subscription.routes');
const restaurantRoutes = require('./restaurant.routes');
const dineRoutes = require('./dine.routes');
const reservationRoutes = require('./reservation.routes');
const p2pRoutes = require('./p2p.routes');
const messagesRoutes = require('./messages.routes');

// Manager workspace delegation (X-Act-As). Runs before every feature router
// so each one sees the target account; no-op without the header.
router.use(actAs);

// Mount routes
router.use('/auth', strictLimiter, authRoutes);
router.use('/cart', cartRoutes);
router.use('/vendors', publicLimiter, cacheResponse({ ttlSeconds: 45 }), vendorRoutes);
router.use('/vendor', vendorRoutes); 
router.use('/products', publicLimiter, cacheResponse({ ttlSeconds: 45 }), productRoutes);
router.use('/orders', orderRoutes);
// Wallet reads use the general API limiter; money-moving writes have a
// per-user limiter inside wallet.routes (walletWriteLimiter).
router.use('/wallet', walletRoutes);
router.use('/escrow', escrowRoutes);
router.use('/chat', chatRoutes);
router.use('/logistics', logisticsRoutes);
router.use('/admin', adminRoutes);
router.use('/manager', managerRoutes);
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
router.use('/legal', cacheResponse({ ttlSeconds: 300 }), legalRoutes);
router.use('/categories', publicLimiter, cacheResponse({ ttlSeconds: 300 }), categoryRoutes);
router.use('/category', cacheResponse({ ttlSeconds: 300 }), categoryRoutes);
router.use('/homepage', cacheResponse({ ttlSeconds: 120 }), homepageRoutes);
router.use('/discovery', publicLimiter, cacheResponse({ ttlSeconds: 60 }), discoveryRoutes);
router.use('/track', trackingRoutes);
router.use('/push', pushRoutes);
router.use('/statuses', statusRoutes);
router.use('/status', statusRoutes);
router.use('/withdrawals', withdrawalRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/dine', publicLimiter, dineRoutes);       // GET /api/dine and /api/dine/restaurant/:id
router.use('/restaurant', restaurantRoutes);           // GET/POST/PATCH /api/restaurant/profile
router.use('/reservations', reservationRoutes);        // Phase 3 Step 14 — dine-in reservations
router.use('/locations', publicLimiter, require('./location.routes'));   // Location search & pin → zone
router.use('/features', publicLimiter, cacheResponse({ ttlSeconds: 30 }), require('./feature.routes')); // Rollout flags
router.use('/p2p', p2pRoutes);                         // P2P Pickup & Delivery
router.use('/messages', messagesRoutes);               // Shipment messages

if (process.env.ENABLE_DEBUG_ROUTES === 'true') {
  router.use('/debug', debugRoutes);
}

module.exports = router;
