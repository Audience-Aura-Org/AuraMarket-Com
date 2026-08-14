/**
 * models/Product.model.js
 * Auradime — Product Schema
 *
 * Defines the structure for products sold by vendors. Includes details like
 * pricing, stock levels, categories, images, and a featured flag for admin control.
 */

const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema(
  {
    vendor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: [true, 'Product must belong to a vendor'],
    },
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: [150, 'Product name cannot exceed 150 characters'],
    },
    description: {
      type: String,
      required: [true, 'Product description is required'],
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    price: {
      type: Number,
      required: [true, 'Product price is required'],
      min: [0, 'Price cannot be negative'],
    },
    compare_at_price: {
      type: Number,
      default: null,
      min: [0, 'Compare-at price cannot be negative'],
    },
    sale_price: {
      type: Number,
      default: null,
      min: [0, 'Sale price cannot be negative'],
    },
    on_sale: {
      type: Boolean,
      default: false,
    },
    images: [
      {
        url: { type: String, required: true },
        alt: { type: String },
      },
    ],
    category: {
      type: String,
      required: [true, 'Product category is required'],
      index: true,
    },
    // Phase 1-Parallel: ObjectId reference alongside the legacy string field.
    // Backfilled by migration 06_category_objectid.js (slug match → name match → log miss).
    // Dual-read: prefer category_id, fall back to category string.
    // Drop category string field only after coverage is 100% and no fallback has fired for a week.
    category_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
      index: true,
    },
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    stock: {
      type: Number,
      required: [true, 'Product stock quantity is required'],
      min: [0, 'Stock cannot be negative'],
      default: 0,
    },
    featured: {
      type: Boolean,
      default: false,
      index: true, // Useful for the homepage feed
    },
    status: {
      type: String,
      enum: ['active', 'draft', 'archived', 'pending', 'suspended'],
      default: 'active',
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    num_reviews: {
      type: Number,
      default: 0,
    },
    // Discovery Metrics
    view_count: {
      type: Number,
      default: 0,
      index: true
    },
    purchase_count: {
      type: Number,
      default: 0,
      index: true
    },
    wishlist_count: {
      type: Number,
      default: 0,
      index: true
    },
    cart_additions: {
      type: Number,
      default: 0,
    },
    specifications: {
      type: String,
      default: '',
    },
    long_description: {
      type: String,
      default: '',
    },
    // Variable Product Support
    has_variants: {
      type: Boolean,
      default: false
    },
    variant_types: [
      {
        name: String, // e.g., "Size", "Color"
        options: [String], // e.g., ["S", "M", "L"], ["Red", "Blue"]
        metadata: mongoose.Schema.Types.Mixed // Optional: { "Red": "#FF0000" }
      }
    ],
    sku_variants: [
      {
        combination: mongoose.Schema.Types.Mixed, // e.g., { "Size": "M", "Color": "Red" }
        price: {
          type: Number,
          required: [true, 'Variant price is required'],
          min: [0, 'Variant price cannot be negative']
        },
        sale_price: {
          type: Number,
          default: null,
          min: [0, 'Variant sale price cannot be negative']
        },
        compare_at_price: {
          type: Number,
          default: null,
          min: [0, 'Variant compare-at price cannot be negative']
        },
        stock: {
          type: Number,
          required: [true, 'Variant stock is required'],
          min: [0, 'Variant stock cannot be negative'],
          default: 0
        },
        sku: String,
        image: String
      }
    ],

    // ── Intercity parcel classification (Phase 4 Step 3) ────────────────────
    // 'small'   — fits in a ~40×30×20 cm box; one person can carry it; eligible for intercity.
    // 'oversize' — blocked from intercity routes; blocked at upload / cart / order placement.
    // Meals always 'small' but already blocked by is_intercity_eligible flag.
    parcel_class: {
      type: String,
      enum: ['small', 'oversize'],
      default: 'small',
    },

    // ── Intercity eligibility ────────────────────────────────────────────────
    // Always false for meals (enforced at upload, cart, and order placement).
    is_intercity_eligible: {
      type: Boolean,
      default: true, // retail default; upload form sets false for meals
    },

    // ── Meal sub-document (Phase 3 Step 4) ──────────────────────────────────
    // Present only when product belongs to a restaurant vendor.
    // StockWatch alerts are suppressed for products with meal != null.
    meal: {
      dietary_tags: [{ type: String, trim: true }], // e.g. 'vegan', 'gluten_free', 'halal'
      spice_level: {
        type: String,
        enum: ['none', 'mild', 'medium', 'hot'],
        default: 'none',
      },

      // Two-level option groups: "pick exactly one size; up to three extras"
      // Required groups must have at least one option with is_default: true.
      // Selected options + price_delta are SNAPSHOT-copied to OrderItem at placement —
      // never joined live. Editing a meal must not rewrite completed orders.
      option_groups: [
        {
          name:        { type: String, required: true },  // e.g. 'Size', 'Extras'
          min_select:  { type: Number, default: 0 },
          max_select:  { type: Number, default: 1 },
          is_required: { type: Boolean, default: false },
          options: [
            {
              label:        { type: String, required: true },
              price_delta:  { type: Number, default: 0 }, // Added to base price
              is_available: { type: Boolean, default: true },
              is_default:   { type: Boolean, default: false },
            },
          ],
        },
      ],

      // Booking types as rows — not a multi-select flat list.
      // Each type carries different attributes; rows avoid eight nullable flat columns.
      // At least one booking option is required (enforced in pre-save hook below).
      booking_options: [
        {
          // Discriminator field
          type: {
            type: String,
            enum: ['delivery', 'pickup', 'pre_order', 'dine_in'],
            required: true,
          },
          // dine_in fields
          slot_minutes: Number,   // Duration of a table slot in minutes
          min_party:    Number,
          max_party:    Number,
          // pre_order fields
          // NOTE: lead_time_minutes ≠ RestaurantProfile.prep_time_minutes.
          // lead_time is customer-facing scheduling lead; prep_time is kitchen timing.
          lead_time_minutes: Number,
          available_from:    Date,  // Start of pre-order availability window
          available_until:   Date,
        },
      ],

      // Per-meal kitchen prep time. Falls back to RestaurantProfile.prep_time_minutes
      // when null. Stored in minutes; displayed with unit conversion on the frontend.
      prep_time_minutes: { type: Number, default: null },

      // Daily availability toggle. Resets every day at availability_resets_at.
      is_available_today: { type: Boolean, default: true },
      availability_resets_at: { type: Date, default: null },

      // Specific date this meal is available for ordering.
      // null = available today/anytime (default).
      // Future date = preorder; order.scheduled_for is set to this date at placement.
      available_date: { type: Date, default: null },
    },

    // ── Restaurant zone scope (Phase 3 Step 10) ──────────────────────────────
    // Denormalised from RestaurantProfile.service_zones for fast feed queries.
    // A background job keeps this in sync when the restaurant edits its service zones.
    // Buyers with no district set never see meals (discovery hides restaurant section).
    service_zone_ids: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'LogisticZone',
      },
    ],
  },
  {
    timestamps: true, // adds createdAt and updatedAt
  }
);

// ── Pre-save: meal validation ─────────────────────────────────────────────────
ProductSchema.pre('save', function () {
  if (!this.meal) return;

  // Meals are never eligible for intercity shipping
  this.is_intercity_eligible = false;

  // Every meal must have at least one booking option
  if (!this.meal.booking_options || this.meal.booking_options.length === 0) {
    throw new Error('A meal product must have at least one booking option (delivery, pickup, pre_order, or dine_in).');
  }

  // Every required option group must have at least one default option
  for (const group of (this.meal.option_groups || [])) {
    if (group.is_required) {
      const hasDefault = (group.options || []).some(opt => opt.is_default);
      if (!hasDefault) {
        throw new Error(`Required option group "${group.name}" must have at least one default option so buyers are never blocked from adding to cart.`);
      }
    }
  }
});

// Indexes for text search
ProductSchema.index({ name: 'text', description: 'text', tags: 'text' });
// Index for filtering
ProductSchema.index({ vendor_id: 1, status: 1 });
ProductSchema.index({ status: 1, featured: -1, updatedAt: -1 });
ProductSchema.index({ status: 1, category: 1, updatedAt: -1 });
ProductSchema.index({ status: 1, category_id: 1, updatedAt: -1 });
ProductSchema.index({ vendor_id: 1, status: 1, updatedAt: -1 });
ProductSchema.index({ status: 1, purchase_count: -1, view_count: -1 });
ProductSchema.index({ service_zone_ids: 1, status: 1 }); // multikey — restaurant feed scoping

module.exports = mongoose.model('Product', ProductSchema);
