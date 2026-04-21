require('dotenv').config();
const mongoose = require('mongoose');
const Status = require('./models/Status.model');
const Vendor = require('./models/Vendor.model');
const Product = require('./models/Product.model');
const User = require('./models/User.model');

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.log(err));

const sampleImages = [
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff', // Red Nike
  'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519', // Sneakers
  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e', // Headphones
  'https://images.unsplash.com/photo-1523275335684-37898b6baf30', // Watch
  'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f', // Camera
  'https://images.unsplash.com/photo-1503602642458-232111445657', // Decor
  'https://images.unsplash.com/photo-1584916201218-f4242ceb4809', // Bags
];

async function seed() {
  try {
    const vendors = await Vendor.find().limit(5);
    const products = await Product.find().limit(10);
    const users = await User.find().limit(20);

    if (vendors.length === 0) {
      console.log('No vendors found. Please ensure vendors are created first.');
      process.exit();
    }

    console.log(`Found ${vendors.length} vendors, ${products.length} products, ${users.length} users.`);

    // Clear old statuses
    await Status.deleteMany({});
    console.log('Cleared old statuses.');

    let count = 0;

    for (let vendor of vendors) {
       // Randomly assign 5 to 8 stories per vendor
      const numStories = Math.floor(Math.random() * 4) + 5;
      
      for (let i = 0; i < numStories; i++) {
        const product = products.length > 0 ? products[Math.floor(Math.random() * products.length)] : null;
        const image = sampleImages[Math.floor(Math.random() * sampleImages.length)];
        // Let some stories be older, some newer, all expiring within 24 hours of creation
        const createdOffset = Math.random() * 12 * 60 * 60 * 1000; // up to 12 hours ago
        const createdAt = new Date(Date.now() - createdOffset);
        const expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);

        // Generate semi-random views and likes based on age
        const hoursOld = createdOffset / 3600000;
        const likes = Math.floor(Math.random() * 50 * hoursOld) + 1;
        const views = likes + Math.floor(Math.random() * 200 * hoursOld) + 10;

        const status = new Status({
          vendor_id: vendor._id,
          type: 'image',
          content_url: image,
          text_content: ['New Drop 🔥', 'Limited Stock! ⏳', 'Restocked today! ✨', 'Check out the details 👇', 'Must have for the season 💎'][Math.floor(Math.random() * 5)],
          linked_product: product ? product._id : null,
          createdAt: createdAt,
          expires_at: expiresAt,
          views_count: Math.floor(views),
          likes_count: Math.floor(likes),
          // Link some actual users for realistic DB relations
          viewer_ids: users.slice(0, Math.min(5, users.length)).map(u => u._id),
          reactions: users.slice(0, Math.min(5, users.length)).map(u => ({ user_id: u._id, type: 'heart' }))
        });

        await status.save();
        count++;
      }
    }

    console.log(`Successfully generated ${count} sample status stories with varying engagement levels!`);
    process.exit();

  } catch (error) {
    console.error(error);
    process.exit();
  }
}

seed();
