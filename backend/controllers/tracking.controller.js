const UserActivity = require('../models/UserActivity.model');
const Product = require('../models/Product.model');

/**
 * Record a user action and update product metrics
 */
const trackAction = async (req, res, next) => {
  try {
    const { 
      product_id, 
      action_type, 
      search_query, 
      category, 
      vendor_id,
      metadata 
    } = req.body;

    const user_id = req.user ? req.user._id : null;
    const permittedActions = new Set(['view', 'wishlist', 'cart_add']);
    if (!permittedActions.has(action_type)) {
      return res.status(400).json({ success: false, message: 'Unsupported tracking action.' });
    }
    
    // Create activity record
    const activity = await UserActivity.create({
      user_id: user_id || '000000000000000000000000', // anonymous if null
      product_id,
      action_type,
      search_query,
      category,
      vendor_id,
      metadata
    });

    // Increment product metrics if it's a product-related action
    if (product_id) {
      let update = {};
      if (action_type === 'view') update.view_count = 1;
      if (action_type === 'wishlist') update.wishlist_count = 1;
      if (action_type === 'cart_add') update.cart_additions = 1;

      if (Object.keys(update).length > 0) {
        await Product.findByIdAndUpdate(product_id, { $inc: update });
      }
    }

    res.status(200).json({
      success: true,
      data: activity
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  trackAction
};
