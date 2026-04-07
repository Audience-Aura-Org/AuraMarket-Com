/**
 * models/Product.model.js
 * Aura Market — Product Schema
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
    images: [
      {
        url: { type: String, required: true },
        alt: { type: String }, // Cloudinary URLs
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
      enum: ['active', 'draft', 'archived', 'pending'],
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
  },
  {
    timestamps: true, // adds createdAt and updatedAt
  }
);

// Indexes for text search
ProductSchema.index({ name: 'text', description: 'text', tags: 'text' });
// Index for filtering
ProductSchema.index({ vendor_id: 1, status: 1 });

module.exports = mongoose.model('Product', ProductSchema);
