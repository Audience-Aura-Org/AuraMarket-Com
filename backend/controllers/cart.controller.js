const Cart = require('../models/Cart.model');
const Product = require('../models/Product.model');
const Vendor = require('../models/Vendor.model');

const variantKey = (variant) => JSON.stringify(variant || null);

const normalizeCartItems = async (cart) => {
  if (!cart?.items?.length) return cart;

  const byProductVariant = new Map();
  let changed = false;

  for (const item of cart.items) {
    const key = `${item.product?.toString()}::${variantKey(item.variant)}`;
    const existing = byProductVariant.get(key);

    if (existing) {
      existing.quantity = Math.max(1, Number(existing.quantity || 0) + Number(item.quantity || 1));
      changed = true;
    } else {
      byProductVariant.set(key, item);
    }
  }

  if (changed) {
    cart.items = Array.from(byProductVariant.values());
    await cart.save();
  }

  return cart;
};

// POST /api/cart -> add/update item
const addToCart = async (req, res, next) => {
  try {
    const {
      product_id,
      quantity = 1,
      variant = null,
      selected_options = [],   // Meal option group selections (Phase 3 Step 6)
      booking_type = null,     // 'delivery' | 'pickup' | 'pre_order' | 'dine_in' for meals
    } = req.body;
    const userId = req.user._id;

    if (!product_id) {
      return res.status(400).json({ success: false, message: 'product_id is required' });
    }

    // Quick product validation (lean — no populate needed here)
    const product = await Product.findById(product_id).lean();
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Own-store check
    const vendor = await Vendor.findOne({ user_id: userId }).select('_id vendor_type').lean();
    if (vendor && product.vendor_id.toString() === vendor._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot purchase your own products' });
    }

    // ── Food/retail context constraints ──────────────────────────────────────
    const isMeal = !!(product.meal);
    const productVendorId = product.vendor_id.toString();

    let cart = await Cart.findOne({ user_id: userId });

    if (cart && cart.items.length > 0) {
      // Use context_booking_type as the food-cart signal (context_vendor_id is only
      // set for dine-in where single-restaurant is enforced).
      const cartHasMeals = !!(cart.context_booking_type);

      if (isMeal && cartHasMeals) {
        // Booking type must always match — can't mix dine-in with delivery, etc.
        if (booking_type && cart.context_booking_type && booking_type !== cart.context_booking_type) {
          return res.status(409).json({
            success: false,
            code: 'BOOKING_TYPE_MISMATCH',
            message: `Your cart is set to ${cart.context_booking_type}. You cannot mix ${booking_type} in the same cart.`,
          });
        }

        // Dine-in is single-restaurant only — you can't dine at two places in one order.
        // Delivery / pickup / pre-order allow multiple restaurants (split into separate
        // orders at checkout, each with their own logistics fee).
        if (cart.context_booking_type === 'dine_in' && booking_type === 'dine_in') {
          if (cart.context_vendor_id && cart.context_vendor_id.toString() !== productVendorId) {
            return res.status(409).json({
              success: false,
              code: 'DIFFERENT_RESTAURANT',
              message: 'Dine-in orders are limited to one restaurant per cart. Clear your cart to dine at this restaurant.',
              data: {
                current_vendor_id: cart.context_vendor_id,
                requested_vendor_id: productVendorId,
              },
            });
          }
        }
      }
      // Retail + food mixing is allowed — each vendor's items will be split
      // into separate orders at checkout with their own logistics fee.

    }

    // Stock Validation (skip for meals — stock field is unused for food)
    if (!isMeal) {
      if (product.has_variants && variant) {
        const targetVariant = product.sku_variants?.find(v =>
          JSON.stringify(v.combination) === JSON.stringify(variant)
        );
        if (!targetVariant || targetVariant.stock < quantity) {
          return res.status(400).json({
            success: false,
            message: targetVariant
              ? `Insufficient stock for selected variant (Only ${targetVariant.stock} left)`
              : 'Selected variant not found',
          });
        }
      } else if (!product.has_variants && product.stock < quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock (Only ${product.stock} left)`,
        });
      }
    }

    const newItem = { product: product_id, quantity, variant, selected_options };

    if (!cart) {
      const cartData = {
        user_id: userId,
        items: [newItem],
        ...(isMeal && {
          context_booking_type: booking_type || 'delivery',
          // Only track vendor for dine-in (single-restaurant enforcement)
          ...(booking_type === 'dine_in' && { context_vendor_id: productVendorId }),
        }),
      };
      cart = await Cart.create(cartData);
    } else {
      const existingItem = cart.items.find(i =>
        i.product.toString() === product_id.toString() &&
        JSON.stringify(i.variant) === JSON.stringify(variant)
      );
      if (existingItem) {
        existingItem.quantity = Math.max(1, existingItem.quantity + quantity);
        if (selected_options.length) existingItem.selected_options = selected_options;
      } else {
        cart.items.push(newItem);
      }
      // Set context on first meal addition
      if (isMeal && !cart.context_booking_type) {
        cart.context_booking_type = booking_type || 'delivery';
        // Only track vendor for dine-in
        if (booking_type === 'dine_in') cart.context_vendor_id = productVendorId;
      }
      await cart.save();
    }

    await normalizeCartItems(cart);
    const updatedCart = await Cart.findById(cart._id).populate({
      path: 'items.product',
      populate: { path: 'vendor_id', select: 'store_name' },
    });

    res.status(200).json({ success: true, data: { cart: updatedCart } });
  } catch (error) {
    console.error('[Cart API] Error in addToCart:', error);
    next(error);
  }
};

// GET /api/cart -> get current user's cart
const getCart = async (req, res, next) => {
  try {
    let cart = await Cart.findOne({ user_id: req.user._id });
    if (!cart) return res.status(200).json({ success: true, data: { cart: { items: [] } } });
    await normalizeCartItems(cart);
    cart = await Cart.findById(cart._id).populate({ path: 'items.product', populate: { path: 'vendor_id', select: 'store_name' } });
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

    const newQty = Math.max(1, item.quantity + (Number(quantity_delta) || 0));
    
    // Check stock for the new quantity
    const product = await Product.findById(item.product).lean();
    if (product) {
      if (product.has_variants && item.variant) {
        const targetVariant = product.sku_variants?.find(v => 
          JSON.stringify(v.combination) === JSON.stringify(item.variant)
        );
        if (targetVariant && targetVariant.stock < newQty) {
          return res.status(400).json({ success: false, message: `Only ${targetVariant.stock} items left in stock` });
        }
      } else if (!product.has_variants && product.stock < newQty) {
        return res.status(400).json({ success: false, message: `Only ${product.stock} items left in stock` });
      }
    }

    item.quantity = newQty;
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

    // Clear food context if cart is now empty
    if (cart && cart.items.length === 0 && cart.context_vendor_id) {
      await Cart.updateOne(
        { _id: cart._id },
        { $set: { context_vendor_id: null, context_booking_type: null, scheduled_for: null } }
      );
    }
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
      { $set: { items: [], context_vendor_id: null, context_booking_type: null, scheduled_for: null } },
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
