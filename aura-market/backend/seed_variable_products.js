const mongoose = require('mongoose');
require('dotenv').config();
const Product = require('./models/Product.model');
const Vendor = require('./models/Vendor.model');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/aura-market';

const variableProducts = [
  {
    name: 'Aura Stealth Matte Watch',
    category: 'Electronics',
    description: 'Precision engineered timepiece with interchangeable straps and premium finish.',
    basePrice: 45000,
    images: ['https://images.unsplash.com/photo-1523275335684-37898b6baf30'],
    types: [
      { name: 'Strap', options: ['Silicon', 'Leather', 'Steel Mesh'] },
      { 
        name: 'Color', 
        options: ['Phantom Black', 'Titanium Silver', 'Rose Gold'],
        metadata: {
          'Phantom Black': '#0A0A0A',
          'Titanium Silver': '#BFC1C2',
          'Rose Gold': '#E0BFB8'
        }
      }
    ]
  },
  {
    name: 'Omni-Comfort Ergonomic Chair',
    category: 'Home',
    description: 'The ultimate workspace companion with 4D armrests and lumbar support.',
    basePrice: 120000,
    images: ['https://images.unsplash.com/photo-1505797149-43b0ad041975'],
    types: [
      { name: 'Upholstery', options: ['Breathable Mesh', 'Vegan Leather'] },
      { 
        name: 'Color', 
        options: ['Carbon', 'Frost', 'Forest'],
        metadata: {
          'Carbon': '#2D2D2D',
          'Frost': '#F5F5F5',
          'Forest': '#2E473B'
        }
      }
    ]
  },
  {
    name: 'Velocity Performance Jacket',
    category: 'Fashion',
    description: 'All-weather protection with aerogel insulation technology.',
    basePrice: 35000,
    images: ['https://images.unsplash.com/photo-1551028719-00167b16eac5'],
    types: [
      { name: 'Size', options: ['S', 'M', 'L', 'XL'] },
      { 
        name: 'Color', 
        options: ['Safety Orange', 'Stealth Gray', 'Midnight Blue'],
        metadata: {
          'Safety Orange': '#FF5733',
          'Stealth Gray': '#333333',
          'Midnight Blue': '#003366'
        }
      }
    ]
  },
  {
    name: 'Glow Pro Skincare Kit',
    category: 'Beauty',
    description: 'Professional grade skincare routine customized for your skin type.',
    basePrice: 15000,
    images: ['https://images.unsplash.com/photo-1556228578-0d85b1a4d571'],
    types: [
      { name: 'Skin Type', options: ['Oily', 'Dry', 'Combination'] },
      { name: 'Size', options: ['Travel', 'Standard', 'Pro'] }
    ]
  },
  {
    name: 'Heritage Leather Boots',
    category: 'Fashion',
    description: 'Hand-stitched full-grain leather boots built to last a lifetime.',
    basePrice: 65000,
    images: ['https://images.unsplash.com/photo-1520639889313-7272a747e671'],
    types: [
      { name: 'Size', options: ['40', '41', '42', '43', '44', '45'] },
      { 
        name: 'Color', 
        options: ['Deep Tan', 'Espresso', 'Pitch Black'],
        metadata: {
          'Deep Tan': '#A0522D',
          'Espresso': '#3D2B1F',
          'Pitch Black': '#000000'
        }
      }
    ]
  },
  {
    name: 'Modular Studio Desk',
    category: 'Home',
    description: 'Expandable desk system designed for creators and producers.',
    basePrice: 85000,
    images: ['https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd'],
    types: [
      { 
        name: 'Finish', 
        options: ['Oak', 'Walnut', 'Birch'],
        metadata: {
          'Oak': '#9E7E53',
          'Walnut': '#432616',
          'Birch': '#DCD0C0'
        }
      },
      { name: 'Width', options: ['120cm', '160cm'] }
    ]
  },
  {
    name: 'Aura Pulse Earbuds',
    category: 'Electronics',
    description: 'True wireless audio with active noise cancellation and spatial sound.',
    basePrice: 22000,
    images: ['https://images.unsplash.com/photo-1590658268037-6bf12165a8df'],
    types: [
      { 
        name: 'Color', 
        options: ['Arctic White', 'Obsidian', 'Lava'],
        metadata: {
          'Arctic White': '#FFFFFF',
          'Obsidian': '#1A1A1B',
          'Lava': '#CF1020'
        }
      }
    ]
  },
  {
    name: 'Zenith Smart Kettle',
    category: 'Electronics',
    description: 'Precision temperature control for the perfect brew every time.',
    basePrice: 28000,
    images: ['https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5'],
    types: [
      { name: 'Capacity', options: ['1.2L', '1.7L'] },
      { 
        name: 'Finish', 
        options: ['Matte Black', 'Stainless', 'Copper'],
        metadata: {
          'Matte Black': '#111111',
          'Stainless': '#C0C0C0',
          'Copper': '#B87333'
        }
      }
    ]
  },
  {
    name: 'Titan Gaming Keyboard',
    category: 'Electronics',
    description: 'Mechanical keyboard with hot-swappable switches and per-key RGB.',
    basePrice: 18000,
    images: ['https://images.unsplash.com/photo-1511467687858-23d96c32e4ae'],
    types: [
      { name: 'Switch', options: ['Linear Red', 'Tactile Brown', 'Clicky Blue'] },
      { 
        name: 'Plate Color', 
        options: ['Jet Black', 'Electric Blue', 'Neon Pink'],
        metadata: {
          'Jet Black': '#000000',
          'Electric Blue': '#0000FF',
          'Neon Pink': '#FF1493'
        }
      }
    ]
  },
  {
    name: 'Lunar Yoga Mat',
    category: 'Wellness',
    description: 'Eco-friendly non-slip mat with alignment guides.',
    basePrice: 8000,
    images: ['https://images.unsplash.com/photo-1544367567-0f2fcb009e0b'],
    types: [
      { name: 'Thickness', options: ['4mm', '6mm'] },
      { 
        name: 'Color', 
        options: ['Deep Purple', 'Seafoam', 'Sage'],
        metadata: {
          'Deep Purple': '#301934',
          'Seafoam': '#9FE2BF',
          'Sage': '#BCB88A'
        }
      }
    ]
  }
];

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // 1. Cleanup Duplicates
    console.log('Cleaning up duplicate products...');
    const duplicates = await Product.aggregate([
      {
        $group: {
          _id: { name: "$name", vendor_id: "$vendor_id" },
          uniqueIds: { $addToSet: "$_id" },
          count: { $sum: 1 }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]);

    let deletedCount = 0;
    for (const dup of duplicates) {
      // Keep the first one, delete the rest
      const [keep, ...toDelete] = dup.uniqueIds;
      const res = await Product.deleteMany({ _id: { $in: toDelete } });
      deletedCount += res.deletedCount;
    }
    console.log(`Deleted ${deletedCount} duplicate products.`);

    // 2. Seed 10 Variable Products
    console.log('Seeding 10 new variable products...');
    const vendors = await Vendor.find();
    if (vendors.length === 0) {
      console.log('No vendors found. Please run the main seed script first.');
      process.exit(1);
    }

    for (let i = 0; i < variableProducts.length; i++) {
      const vp = variableProducts[i];
      const vendor = vendors[i % vendors.length]; // Distribute among vendors

      const product = new Product({
        vendor_id: vendor._id,
        name: vp.name,
        description: vp.description,
        price: vp.basePrice,
        category: vp.category,
        stock: 200,
        images: vp.images.map(url => ({ url: `${url}?w=800&q=80&auto=format` })),
        status: 'active',
        has_variants: true,
        variant_types: vp.types,
        sku_variants: []
      });

      // Generate combinations
      const combs = [];
      const generateCombs = (depth, current) => {
        if (depth === vp.types.length) {
          combs.push({ ...current });
          return;
        }
        const type = vp.types[depth];
        for (const opt of type.options) {
          current[type.name] = opt;
          generateCombs(depth + 1, current);
        }
      };
      generateCombs(0, {});

      product.sku_variants = combs.map((c, idx) => ({
        combination: c,
        price: vp.basePrice + (idx * 1500), // Incremental price for demo
        stock: 10 + Math.floor(Math.random() * 50),
        sku: `VAR-${vp.name.slice(0,3).toUpperCase()}-${idx}-${Math.random().toString(36).substring(7).toUpperCase()}`,
        image: `${vp.images[0]}?w=800&q=80&auto=format&sig=${idx}`
      }));

      await product.save();
      console.log(`Seeded: ${vp.name} (${product.sku_variants.length} variations)`);
    }

    // 3. Seed Status Updates with Categories
    console.log('Seeding status updates with categories...');
    const Status = require('./models/Status.model');
    await Status.deleteMany({});
    
    const statuses = [];
    vendors.forEach((vendor, i) => {
      const category = ['Fashion', 'Electronics', 'Lifestyle', 'Tech', 'Art', 'Beauty', 'General'][i % 7];
      statuses.push({
        vendor_id: vendor._id,
        type: 'image',
        content_url: `https://picsum.photos/seed/${vendor._id}/1080/1920`,
        caption: `New drop in ${category}! Check it out.`,
        category: category,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });
    });
    await Status.insertMany(statuses);
    console.log(`✅ Seeded ${statuses.length} statuses with categories`);

    console.log('Variable product seeding and cleanup completed!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

seed();
