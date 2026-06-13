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
    sale_price: {
      type: Number,
      default: null,
      min: [0, 'Sale price cannot be negative'],
      // NOTE: The cross-field check (sale_price < price) is enforced in
      // normalizeSalePricing() before every create/update. We intentionally
      // omit a schema-level validator here because Mongoose's `this` context
      // inside findByIdAndUpdate validators is the Query, not the document,
      // so `this.price` is always undefined → 0, causing false 400 errors.
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
        price: Number,
        stock: Number,
        sku: String,
        image: String
      }
    ]
  },
  {
    timestamps: true, // adds createdAt and updatedAt
  }
);

// Indexes for text search
ProductSchema.index({ name: 'text', description: 'text', tags: 'text' });
// Index for filtering
ProductSchema.index({ vendor_id: 1, status: 1 });
ProductSchema.index({ status: 1, featured: -1, updatedAt: -1 });
ProductSchema.index({ status: 1, category: 1, updatedAt: -1 });
ProductSchema.index({ vendor_id: 1, status: 1, updatedAt: -1 });
ProductSchema.index({ status: 1, purchase_count: -1, view_count: -1 });

module.exports = mongoose.model('Product', ProductSchema);
