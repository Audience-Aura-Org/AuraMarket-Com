/**
 * scripts/seed-homepage.js
 * Seed initial modular homepage sections for Aura Market
 */

require('dotenv').config({ path: '../.env' }); 
const mongoose = require('mongoose');
const HomepageSection = require('../models/HomepageSection.model');
const Product = require('../models/Product.model');
const Vendor = require('../models/Vendor.model');

const seedHomepage = async () => {
  try {
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) throw new Error("Missing MONGODB_URI");
    await mongoose.connect(MONGODB_URI);

    console.log("Cleaning up existing homepage sections...");
    await HomepageSection.deleteMany({});

    console.log("Fetching some products and vendors for references...");
    const products = await Product.find().limit(8);
    const vendors = await Vendor.find().limit(3);

    const sections = [
      // 1. Hero Banner
      {
        type: 'hero',
        order: 1,
        is_active: true,
        config: { autoplay: true, interval: 6000 },
        data: [
          {
            image_url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=1920',
            headline: 'The Aura Collection',
            subtext: 'Discover the future of premium multi-vendor shopping with liquid glass aesthetics.',
            cta_text: 'Explore Now',
            link_to: '/shop'
          },
          {
            image_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=1920',
            headline: 'Pure Audio. Pure Glass.',
            subtext: 'Elite headphones and audio gear from verified audiophile vendors.',
            cta_text: 'Shop Tech',
            link_to: '/shop?category=Tech'
          }
        ]
      },

      // 2. Category Carousel
      {
        type: 'categories',
        title: 'Curated Categories',
        order: 2,
        is_active: true,
        data: [
          { category_name: 'Tech', image_url: 'https://images.unsplash.com/photo-1491933382434-500287f9b54b?auto=format&fit=crop&q=80&w=400' },
          { category_name: 'Fashion', image_url: 'https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&q=80&w=400' },
          { category_name: 'Home', image_url: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&q=80&w=400' },
          { category_name: 'Wellness', image_url: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&q=80&w=400' },
          { category_name: 'Art', image_url: 'https://images.unsplash.com/photo-1460661419201-fd4ce186860d?auto=format&fit=crop&q=80&w=400' }
        ]
      },

      // 3. Featured Products
      {
        type: 'featured_products',
        title: 'Featured This Week',
        subtitle: 'Handpicked excellence from our top-performing storefronts.',
        order: 3,
        is_active: true,
        config: { layout: 'grid' },
        data: products.slice(0, 4).map(p => ({ product_id: p._id }))
      },

      // 4. Promo Banner
      {
        type: 'promo_banner',
        order: 4,
        is_active: true,
        data: [
          {
            image_url: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&q=80&w=1920',
            headline: 'Spring Solstice Sale',
            subtext: 'Up to 40% off on all Fashion & Lifestyle collections.',
            cta_text: 'Claim Offer',
            link_to: '/shop?sale=true'
          }
        ]
      },

      // 5. Vendor Highlights
      {
        type: 'stores',
        title: 'Elite Partners',
        order: 5,
        is_active: true,
        data: vendors.map(v => ({ vendor_id: v._id }))
      }
    ];

    await HomepageSection.create(sections);
    console.log("Successfully seeded homepage sections!");
    process.exit(0);
  } catch (err) {
    console.error("Seed error:", err);
    process.exit(1);
  }
};

seedHomepage();
