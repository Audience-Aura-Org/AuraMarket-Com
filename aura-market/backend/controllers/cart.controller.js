const Cart = require('../models/Cart.model');
const Product = require('../models/Product.model');

// POST /api/cart -> add/update item
const addToCart = async (req, res, next) => {
  try {
    const { product_id, quantity = 1 } = req.body;
    const userId = req.user._id;
    
    if (!product_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'product_id is required' 
      });
    }
    
    // Quick product validation (use lean for speed)
    const product = await Product.findById(product_id).lean();
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }
    
    // Vendor check via product vendor_id instead of separate query
    const vendor = await require('../models/Vendor.model').findOne({ user_id: userId }).lean();
    if (vendor && product.vendor_id.toString() === vendor._id.toString()) {
      return res.status(400).json({ 
        success: false, 
        message: "Cannot purchase your own products" 
      });
    }

    // Fast cart update using findOneAndUpdate (atomic operation)
    // First try to find existing cart and update, or create new one
    let cart = await Cart.findOne({ user_id: userId });
    
    if (!cart) {
      cart = await Cart.create({ 
        user_id: userId, 
        items: [{ product: product_id, quantity }] 
      });
    } else {
      const existingItem = cart.items.find(i => i.product.toString() === product_id.toString());
      if (existingItem) {
        existingItem.quantity = Math.max(1, existingItem.quantity + quantity);
      } else {
        cart.items.push({ product: product_id, quantity });
      }
      await cart.save();
    }
    
    // Populate only essential fields for speed
    const updatedCart = await Cart.findById(cart._id).populate('items.product', 'name price images stock');

    console.log(`[Cart API] Added product ${product_id} to cart for user ${userId}`);
    res.status(200).json({ 
      success: true, 
      data: { cart: updatedCart } 
    });
  } catch (error) {
    console.error("[Cart API] Error in addToCart:", error);
    next(error);
  }
};

// GET /api/cart -> get current user's cart
const getCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user_id: req.user._id }).populate({ path: 'items.product', populate: { path: 'vendor_id', select: 'store_name' } });
    if (!cart) return res.status(200).json({ success: true, data: { cart: { items: [] } } });
    res.status(200).json({ success: true, data: { cart } });
  } catch (error) {
    next(error);
  }
};

const updateCartQty = async (req, res, next) => {
  try {
    const { item_id, quantity_delta } = req.body;
    if (!item_id) return res.status(400).json({ success: false, message: 'item_id is required' });

    const cart = await Cart.findOne({ user_id: req.user._id });
    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });

    // Robust item finding: Check by subdoc ID first, fallback to Product ID string comparison
    let item = cart.items.id(item_id);
    if (!item) {
      item = cart.items.find(i => i.product.toString() === item_id.toString() || i._id?.toString() === item_id.toString());
    }
    
    if (!item) {
      console.error(`[Cart API] Item ${item_id} not found in cart for user ${req.user._id}`);
      return res.status(404).json({ success: false, message: 'Item not found in cart' });
    }

    item.quantity = Math.max(1, item.quantity + (Number(quantity_delta) || 0));
    await cart.save();

    const populated = await Cart.findById(cart._id).populate({ path: 'items.product', populate: { path: 'vendor_id', select: 'store_name' } });
    res.status(200).json({ success: true, data: { cart: populated } });
  } catch (error) {
    console.error(`[Cart API] Update quantity error:`, error);
    next(error);
  }
};

const removeFromCart = async (req, res, next) => {
  try {
    const { item_id } = req.body;
    if (!item_id) return res.status(400).json({ success: false, message: 'item_id is required' });

    const mongoose = require('mongoose');
    // Prepare IDs safely
    const oid = mongoose.Types.ObjectId.isValid(item_id) ? new mongoose.Types.ObjectId(item_id) : null;
    
    console.log(`[Cart API] Atomic pull for user ${req.user._id}. Target item_id: ${item_id}`);

    // Standard $pull supports multiple criteria in the sub-document filter
    const cart = await Cart.findOneAndUpdate(
      { user_id: req.user._id },
      { 
        $pull: { 
          items: {
            $or: [
              { _id: oid },
              { product: oid },
              { _id: item_id },
              { product: item_id }
            ]
          } 
        } 
      },
      { returnDocument: 'after' }
    ).populate({ path: 'items.product', populate: { path: 'vendor_id', select: 'store_name' } });

    console.log(`[Cart API] Atomic pull finished. New items count: ${cart?.items?.length || 0}`);
    res.status(200).json({ success: true, data: { cart } });
  } catch (error) {
    console.error(`[Cart API] Atomic delete failed:`, error);
    next(error);
  }
};

const clearCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOneAndUpdate(
      { user_id: req.user._id },
      { $set: { items: [] } },
      { returnDocument: 'after', upsert: true }
    ).populate({ path: 'items.product', populate: { path: 'vendor_id', select: 'store_name' } });

    res.status(200).json({ success: true, data: { cart } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  addToCart,
  getCart,
  updateCartQty,
  updateCartQuantity: updateCartQty,
  removeFromCart,
  clearCart,
};
