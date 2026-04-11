
require('dotenv').config();
const mongoose = require('mongoose');
const { MONGODB_URI } = require('../config/env');

const User = require('../models/User.model');
const Vendor = require('../models/Vendor.model');
const Product = require('../models/Product.model');
const Order = require('../models/Order.model');
const Review = require('../models/Review.model');
const Dispute = require('../models/Dispute.model');
const LogisticsCompany = require('../models/LogisticsCompany.model');

const seedInteractions = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB for seeding interactions...");

    // 1. Find participants
    const customer = await User.findOne({ email: 'customer1@auramarket.com' });
    const vendorUser = await User.findOne({ email: 'vendor1@auramarket.com' });
    const logisticsUser = await User.findOne({ email: 'logistics1@auramarket.com' });

    if (!customer || !vendorUser || !logisticsUser) {
      console.error("Missing seed users. Run seed.js first.");
      process.exit(1);
    }

    const vendor = await Vendor.findOne({ user_id: vendorUser._id });
    const product = await Product.findOne({ vendor_id: vendor._id });
    
    // Ensure Logistics Company profile exists
    let logistics = await LogisticsCompany.findOne({ user_id: logisticsUser._id });
    if (!logistics) {
        logistics = await LogisticsCompany.create({
            user_id: logisticsUser._id,
            company_name: 'Logistics Alpha',
            contact_email: 'logistics1@auramarket.com',
            contact_phone: '+237600000001',
            service_regions: ['Douala', 'Yaounde'],
            is_verified: true,
            quartier_prices: [
                { quartier: 'Bonamoussadi', price: 1500 },
                { quartier: 'Akwa', price: 1000 }
            ]
        });
    }

    // 2. Clear old test interactions (optional but good for clean test)
    // await Order.deleteMany({ customer_id: customer._id });
    // await Review.deleteMany({ user_id: customer._id });
    // await Dispute.deleteMany({ initiator_id: customer._id });

    // 3. Create a COMPLETED Order for Review
    const completedOrder = await Order.create({
        customer_id: customer._id,
        vendor_id: vendor._id,
        products: [{
            product_id: product._id,
            name: product.name,
            quantity: 1,
            price: product.price,
            image: product.images[0]?.url
        }],
        subtotal: product.price,
        shipping_fee: 1500,
        total_amount: product.price + 1500,
        payment_method: 'wallet',
        payment_status: 'paid',
        order_status: 'completed',
        shipping_method: 'logistics_partner',
        logistics_company_id: logistics._id,
        shipping_address: {
            street: '123 Main St',
            city: 'Douala',
            quartier: 'Bonamoussadi',
            phone: customer.phone || '000000000',
            email: customer.email
        }
    });

    // 4. Create a Review for the completed order
    await Review.create({
        user_id: customer._id,
        product_id: product._id,
        order_id: completedOrder._id,
        rating: 5,
        comment: 'Absolutely amazing headphones! The sound quality is studio-grade and the liquid glass finish is stunning. Fast delivery too!',
        images: [
            'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=400&q=80'
        ]
    });

    // Update product rating
    product.rating = 5;
    product.num_reviews = (product.num_reviews || 0) + 1;
    await product.save();

    // 5. Create a DISPUTED Order
    const disputedOrder = await Order.create({
        customer_id: customer._id,
        vendor_id: vendor._id,
        products: [{
            product_id: product._id,
            name: product.name,
            quantity: 1,
            price: product.price,
            image: product.images[0]?.url
        }],
        subtotal: product.price,
        shipping_fee: 1000,
        total_amount: product.price + 1000,
        payment_method: 'wallet',
        payment_status: 'paid',
        order_status: 'shipped',
        shipping_method: 'logistics_partner',
        logistics_company_id: logistics._id,
        shipping_address: {
            street: '456 Tech Lane',
            city: 'Douala',
            quartier: 'Akwa',
            phone: customer.phone || '000000000',
            email: customer.email
        }
    });

    // 6. Create a Dispute for the shipped order
    await Dispute.create({
        order_id: disputedOrder._id,
        initiator_id: customer._id,
        reason: 'faulty_item',
        description: 'I received the headphones today. Upon opening the box, I noticed the left ear cup has a crack. When I turned them on, there is a persistent static sound in the left ear.',
        evidence_urls: [
            'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=400&q=80'
        ],
        status: 'pending'
    });

    console.log("SUCCESS_SEEDED_INTERACTIONS");
    process.exit(0);
  } catch (err) {
    console.error("SEED_INTERACTIONS_ERROR:", err);
    process.exit(1);
  }
};

seedInteractions();
