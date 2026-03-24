/**
 * scripts/seedHomepage.js
 * Creates sample sections for the homepage.
 */
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const HomepageSection = require('../models/HomepageSection.model');
const Product = require('../models/Product.model');
const Category = require('../models/Category.model');
const Vendor = require('../models/Vendor.model');

const seed = async () => {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected!');

        // 1. Get some sample data
        const sampleProduct = await Product.findOne();
        const sampleCategory = await Category.findOne();
        const sampleVendor = await Vendor.findOne();

        const productId = sampleProduct ? sampleProduct._id : new mongoose.Types.ObjectId();
        const categoryName = sampleCategory ? sampleCategory.name : 'Electronics';
        const vendorId = sampleVendor ? sampleVendor._id : new mongoose.Types.ObjectId();

        console.log('Using Sample Data:', { productId, categoryName, vendorId });

        // 2. Clear existing (optional - user said "create sample so I can edit", maybe they want a clean start)
        await HomepageSection.deleteMany({});
        console.log('Cleared existing sections.');

        const sections = [
            {
                type: 'hero',
                title: 'Summer Collection 2026',
                subtitle: 'Discover the latest trends in modern tech and fashion.',
                order: 1,
                is_active: true,
                config: { autoplay: true, layout: 'carousel' },
                data: [
                    {
                        headline: 'The Future of Gaming',
                        subtext: 'Get 20% off on all next-gen consoles this week.',
                        image_url: 'https://images.unsplash.com/photo-1612287230202-1ff1d85d1bdf?q=80&w=2071&auto=format&fit=crop',
                        link_to: '/shop',
                        cta_text: 'Shop Gaming'
                    },
                    {
                        headline: 'Liquid Glass Aesthetics',
                        subtext: 'Bespoke designs for the modern home office.',
                        image_url: 'https://images.unsplash.com/photo-1493666438817-866a91353ca9?q=80&w=2069&auto=format&fit=crop',
                        link_to: '/categories/home-office',
                        cta_text: 'Explore Decor'
                    }
                ]
            },
            {
                type: 'categories',
                title: 'Browse Top Categories',
                subtitle: 'Find exactly what you need in our curated departments.',
                order: 2,
                is_active: true,
                config: { layout: 'carousel' },
                data: [
                    { category_name: 'Electronics', image_url: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?q=80&w=2070&auto=format&fit=crop', link_to: '/shop?category=Electronics' },
                    { category_name: 'Fashion', image_url: 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?q=80&w=2070&auto=format&fit=crop', link_to: '/shop?category=Fashion' },
                    { category_name: categoryName, image_url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=1999&auto=format&fit=crop', link_to: `/shop?category=${encodeURIComponent(categoryName)}` }
                ]
            },
            {
                type: 'featured_products',
                title: 'Featured This Week',
                subtitle: 'Hand-picked premium products for our valued members.',
                order: 3,
                is_active: true,
                config: { layout: 'grid' },
                data: [
                    { product_id: productId }
                ]
            },
            {
                type: 'promo_banner',
                title: 'Flash Sale',
                subtitle: 'Limited time offers on premium brands.',
                order: 4,
                is_active: true,
                config: { layout: 'grid' },
                data: [
                    {
                        headline: 'Big Brand Days',
                        subtext: 'Up to 50% discount on Nike, Apple, and More.',
                        image_url: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=2070&auto=format&fit=crop',
                        link_to: '/promos',
                        cta_text: 'View Deals'
                    }
                ]
            },
            {
                type: 'stores',
                title: 'Top Rated Vendors',
                subtitle: 'Verified shops with consistent 5-star service.',
                order: 5,
                is_active: true,
                config: { layout: 'carousel' },
                data: [
                    { vendor_id: vendorId }
                ]
            }
        ];

        await HomepageSection.insertMany(sections);
        console.log('Successfully seeded 5 sample sections.');
        process.exit(0);
    } catch (err) {
        console.error('Seeding failed:', err);
        process.exit(1);
    }
};

seed();
