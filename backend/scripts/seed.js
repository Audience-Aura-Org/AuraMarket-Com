require('dotenv').config({ path: '../.env' }); 
const mongoose = require('mongoose');
require('dotenv').config();

const { MONGODB_URI } = require('../config/env');
const User = require('../models/User.model');
const Vendor = require('../models/Vendor.model');
const Store = require('../models/Store.model');
const Product = require('../models/Product.model');

const seedDatabase = async () => {
  try {
    if (!MONGODB_URI) throw new Error("Missing MONGODB_URI");
    await mongoose.connect(MONGODB_URI);
    
    await User.deleteMany({});
    await Vendor.deleteMany({});
    await Store.deleteMany({});
    await Product.deleteMany({});
    
    // Admins
    await User.create([
      { name: 'Admin One', email: 'admin1@auradime.com', password: 'password123', role: 'admin', is_active: true },
      { name: 'Admin Two', email: 'admin2@auradime.com', password: 'password123', role: 'admin', is_active: true }
    ]);

    // Customers
    await User.create([
      { name: 'Jane Customer', email: 'customer1@auradime.com', password: 'password123', role: 'customer' },
      { name: 'John Buyer', email: 'customer2@auradime.com', password: 'password123', role: 'customer' }
    ]);

    // Logistics
    await User.create([
      { name: 'Logistics Alpha', email: 'logistics1@auradime.com', password: 'password123', role: 'logistics', is_active: true },
      { name: 'Logistics Beta', email: 'logistics2@auradime.com', password: 'password123', role: 'logistics', is_active: true }
    ]);

    // Vendors
    const vendorUsers = await User.create([
      { name: 'Tech Store Owner', email: 'vendor1@auradime.com', password: 'password123', role: 'vendor' },
      { name: 'Fashion Boutique', email: 'vendor2@auradime.com', password: 'password123', role: 'vendor' }
    ]);
    
    const vendorProfiles = await Vendor.create([
      { user_id: vendorUsers[0]._id, store_name: 'Aura Tech Pro', description: 'Premium Tech Gear', verified: true, is_onboarded: true },
      { user_id: vendorUsers[1]._id, store_name: 'Aura Fashion Elite', description: 'High-end streetwear', verified: true, is_onboarded: true }
    ]);

    const stores = await Store.create([
      { vendor_id: vendorProfiles[0]._id, name: 'Aura Tech Pro', description: 'The best tech on the market', banner_image: '', status: 'active' },
      { vendor_id: vendorProfiles[1]._id, name: 'Aura Fashion Elite', description: 'Exclusive drops and threads', banner_image: '', status: 'active' }
    ]);

    const PRODUCT_IMAGES = [
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCu4Kg0QrQgbLd9-z7hgjDKHPBzQozELPpnFWun3wP9oAvGgY33iSkoIkhYj-7ryElUP5Da2WdcU4H3ZsnKPKvQfBmPmVfKaO_tHw0sctqlXmN-IxGo4GwzppY_7oGakdzYuxfznmiay9Gt4E9_MTWAJIx6M8zJgurlAANbjoddoMYzJ056TldlxWFTP0KBZMnJ_tBcRxvXAxFIP9lJWveEePbgMw_kn8wiPswGz-Fgu_RmnYUkDEScZyRQunmxxn_L56pTlyRwG5Q",
      "https://lh3.googleusercontent.com/aida-public/AB6AXuClGN2q4Df-1IYxQUl0yYXkAfwzYjZTgCIBb5OkEh2i8WXjPMtj6Pi9I0MKuWcjk8IbowSrZNunxj_Swr-OiPmerzD2xQ-6X9zK3r1RId4sbTo-mP95jkMDXJo6DZWE5UUNo4m2pIdWjEADIggeeE7MI2VJuj3sfFG7Pif-bxqx_lcnVCvEt4JZZO6YlNrD5jHOqzAj34lTfepsgyWOeG8JXhOQaeXhvwiYex1t2rpwDgLQHNTEU62eNF4h9IHeqYNkrWZyuGx7w-s",
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDFDN_PVnP2yl5-yDuLW0rYsdx6e8t2yUYzbewtYepIdO-W1BwCeDSPhig5-P-v6C75AGJceApmkDdF6hAtSifqeM_sUrZMVkrWUE1QNgnW4WLYzrvUZy2e_5VE3t4jnE3ZcW3MgtM-2qIKcuGePJTplV73nEIog3_tFCM0O0Tk-XcsFRarGfWxZWhA8hBxNugwI855J-ayeM9d-f34tCsIe_4YD5pR3eNELz6SwpnoFvLoPMEsOe5RAx5cD-wJ9Nh47To5oqhnGVU",
      "https://lh3.googleusercontent.com/aida-public/AB6AXuD5JOxAi25fyrAzs5mxsoYRyQ4OtLO1e8qnaO6HR9cb5ZUaW8BXdnYZt9rlpAahRgmsQpoDKEJwSd_B75Ng5SMmkYlZE8GdlkDFvdUVgveL3UiYxMGkCn0ri9zkCjQvdEtYfcPZEYiYEbA2wmyCSeNE23G_1ydXQMVjUbGr1Jrtr2C84GM0yVdpcfWU83PUwXvVaT5jYqF97Boou08b4eV1mo7864a0tP-ftuZ96UCB9UN31rwwBm7Mz3xSWBW0m-N9MbTaCZBt-KI",
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCVSxgl8dOxcopf0A_Jz4nCPRgjJOiUj6M6yAI8C0C2pTcAd5hJ2lMwdxtKCigo0KSwlmyXRS1LvscBuDi9J7s-cCLux-evE5oZBfdvRBe8m5RNDX_UhdvOt_y0ah6frzXEQtdnETyg6z8ZluTD8IDwgNpawaN-Ap_O3_Ox_EIHngOxiLFJEF49JPY1HVNPWgl9RSKxkr96u-KesiHNryCCseWi2nebV01wrwwAb6CvWzXiuuehmlr9lC-K6g0En2Bl2GEWe9K1uGI",
    ];

    await Product.create([
      { vendor_id: vendorProfiles[0]._id, name: 'Aura Pro Max Headphones', description: 'Crystal clear audio and noise cancellation.', price: 299, category: 'Tech', tags: ['audio', 'headphones'], stock: 50, featured: true, images: [{ url: PRODUCT_IMAGES[0] }] },
      { vendor_id: vendorProfiles[0]._id, name: 'Nebula Smart Watch V2', description: 'Advanced health tracking and liquid UI.', price: 185, category: 'Gadgets', tags: ['watch', 'smart'], stock: 120, featured: true, images: [{ url: PRODUCT_IMAGES[1] }] },
      { vendor_id: vendorProfiles[1]._id, name: 'Aura Glide Sneakers', description: 'Engineered for comfort and style.', price: 120, category: 'Fashion', tags: ['shoes', 'sneakers'], stock: 30, featured: false, images: [{ url: PRODUCT_IMAGES[2] }] },
      { vendor_id: vendorProfiles[1]._id, name: 'Visionary Shades X', description: 'Protect your eyes with style.', price: 75, category: 'Fashion', tags: ['glasses', 'shades', 'accessories'], stock: 200, featured: false, images: [{ url: PRODUCT_IMAGES[3] }] },
      { vendor_id: vendorProfiles[0]._id, name: 'Minimalist Workspace Kit', description: 'Productivity tools for creators', price: 45, category: 'Tech', tags: ['desk', 'office'], stock: 15, featured: true, images: [{ url: PRODUCT_IMAGES[4] }] }
    ]);
    
    console.log("SUCCESS_SEEDED");
    process.exit(0);
  } catch (error) {
    console.log("SEED_ERROR_OUTPUT:");
    console.log(error);
    process.exit(1);
  }
};
seedDatabase();
