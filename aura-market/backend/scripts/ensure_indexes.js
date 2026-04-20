/**
 * scripts/ensure_indexes.js
 * Aura Market — Database Indexing Optimization
 */
const mongoose = require('mongoose');
require('dotenv').config();

const ensureIndexes = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;
    if (!mongoURI) throw new Error('MONGODB_URI is not defined in environment variables');
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(mongoURI);
    console.log('Connected.');

    const Product = require('../models/Product.model');
    const User = require('../models/User.model');
    const Vendor = require('../models/Vendor.model');
    const Follow = require('../models/Follow.model');
    const Category = require('../models/Category.model');

    console.log('Ensuring Product indexes...');
    const productSpecs = [
      { status: 1, vendor_id: 1 },
      { status: 1, category: 1 },
      { status: 1, createdAt: -1 },
      { popularity_score: -1, createdAt: -1 }
    ];
    for (const spec of productSpecs) {
      try { await Product.collection.createIndex(spec); } catch (e) { /* ignore conflicts */ }
    }

    console.log('Ensuring Follow indexes...');
    try { await Follow.collection.createIndex({ user_id: 1 }); } catch (e) {}
    try { await Follow.collection.createIndex({ vendor_id: 1 }); } catch (e) {}

    console.log('Ensuring Category indexes...');
    try { await Category.collection.createIndex({ name: 1 }); } catch (e) {}
    try { await Category.collection.createIndex({ parent_id: 1 }); } catch (e) {}

    console.log('Ensuring User/Vendor indexes...');
    try { await User.collection.createIndex({ username: 1 }); } catch (e) {}
    try { await User.collection.createIndex({ email: 1 }); } catch (e) {}
    try { await Vendor.collection.createIndex({ user_id: 1 }); } catch (e) {}
    try { await Vendor.collection.createIndex({ store_name: 'text' }); } catch (e) {}

    console.log('✅ All critical performance indexes ensured.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to ensure indexes:', err);
    process.exit(1);
  }
};

ensureIndexes();
