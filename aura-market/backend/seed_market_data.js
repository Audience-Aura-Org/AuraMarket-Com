const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User.model');
const Vendor = require('./models/Vendor.model');
const Store = require('./models/Store.model');
const Product = require('./models/Product.model');
const Status = require('./models/Status.model');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/aura-market';

const categories = {
  Electronics: {
    products: [
      'https://images.unsplash.com/photo-1496181133206-80ce9b88a853', // Laptop
      'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9', // Phone
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e', // Headphones
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30', // Watch
      'https://images.unsplash.com/photo-1507582020474-9a35b7d455d9', // Drone
      'https://images.unsplash.com/photo-1545454675-3531b543be5d', // Speaker
      'https://images.unsplash.com/photo-1587829741301-dc798b83add3', // Keyboard
      'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46', // Mouse
      'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf', // Monitor
      'https://images.unsplash.com/photo-1516035069371-29a1b244cc32'  // Camera
    ],
    statuses: [
      'https://images.unsplash.com/photo-1468495244122-4a949437f48e',
      'https://images.unsplash.com/photo-1550745165-9bc0b252726f',
      'https://images.unsplash.com/photo-1519389950473-47ba0277781c',
      'https://images.unsplash.com/photo-1531297484001-80022131f5a1',
      'https://images.unsplash.com/photo-1498050108023-c5249f4df085',
      'https://images.unsplash.com/photo-1451187580459-43490279c0fa',
      'https://images.unsplash.com/photo-1518770660439-4636190af475'
    ]
  },
  Fashion: {
    products: [
      'https://images.unsplash.com/photo-1521572267360-ee0c2909d518', // Shirt
      'https://images.unsplash.com/photo-1515378791036-0648a3ef77b2', // Dress
      'https://images.unsplash.com/photo-1551028719-00167b16eac5', // Jacket
      'https://images.unsplash.com/photo-1541099649105-f69ad21f3246', // Pants
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff', // Shoes
      'https://images.unsplash.com/photo-1584916201218-f4242ceb4809', // Bag
      'https://images.unsplash.com/photo-1511499767390-91f1976f4042', // Sunglasses
      'https://images.unsplash.com/photo-1533055640609-24b498dfd74c', // Hat
      'https://images.unsplash.com/photo-1520903920243-00d872a2d1c9', // Scarf
      'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338'  // Jewelry
    ],
    statuses: [
      'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04',
      'https://images.unsplash.com/photo-1483985988355-763728e1935b',
      'https://images.unsplash.com/photo-1490481651871-ab68de25d43d',
      'https://images.unsplash.com/photo-1445205170230-053b830c6050',
      'https://images.unsplash.com/photo-1539109136881-3be0616acf4b',
      'https://images.unsplash.com/photo-1492707892479-7bc8d5a4ee93',
      'https://images.unsplash.com/photo-1479064566235-aa2742b9314e'
    ]
  },
  Home: {
    products: [
      'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c', // Chair
      'https://images.unsplash.com/photo-1507473885765-e6ed057f782c', // Lamp
      'https://images.unsplash.com/photo-1581783898377-1c85bf937427', // Vase
      'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2', // Cushion
      'https://images.unsplash.com/photo-1531835551805-16d864c8d311', // Rug
      'https://images.unsplash.com/photo-1563861826100-9cb868fdbe1c', // Clock
      'https://images.unsplash.com/photo-1513519245088-0e12902e5a38', // Mirror
      'https://images.unsplash.com/photo-1485955900006-10f4d324d411', // Plant
      'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1', // Shelf
      'https://images.unsplash.com/photo-1577146333359-39f79bd448ce'  // Table
    ],
    statuses: [
      'https://images.unsplash.com/photo-1513584684374-8bdb74838a0f',
      'https://images.unsplash.com/photo-1484101403033-57105d2b77ca',
      'https://images.unsplash.com/photo-1505691938895-1758d7eaa511',
      'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af',
      'https://images.unsplash.com/photo-1586023492125-27b2c045efd7',
      'https://images.unsplash.com/photo-1554995207-c18c203602cb',
      'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e'
    ]
  },
  Beauty: {
    products: [
      'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881', // Cream
      'https://images.unsplash.com/photo-1620916566398-39f1143ab7be', // Serum
      'https://images.unsplash.com/photo-1586776977607-310e9c725c37', // Lipstick
      'https://images.unsplash.com/photo-1541643600914-78b084683601', // Perfume
      'https://images.unsplash.com/photo-1522338242992-e1a54906a8da', // Brush
      'https://images.unsplash.com/photo-1596755094514-f87e34085b2c', // Mask
      'https://images.unsplash.com/photo-1608248597279-f99d160bfcbc', // Oil
      'https://images.unsplash.com/photo-1600857062241-98e5dba7f214', // Soap
      'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d', // Shampoo
      'https://images.unsplash.com/photo-1512496011951-a6994413c2ae'  // Palette
    ],
    statuses: [
      'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9',
      'https://images.unsplash.com/photo-1512496011951-a6994413c2ae',
      'https://images.unsplash.com/photo-1522337660859-02fbefca4702',
      'https://images.unsplash.com/photo-1515377905703-c4788e51af15',
      'https://images.unsplash.com/photo-1596462502278-27bfdc4033c8',
      'https://images.unsplash.com/photo-1571781926291-c477ebfd024b',
      'https://images.unsplash.com/photo-1556228720-195a672e8a03'
    ]
  },
  Wellness: {
    products: [
      'https://images.unsplash.com/photo-1592432678899-3a328f64263b', // Yoga mat
      'https://images.unsplash.com/photo-1517836357463-d25dfeac3438', // Weights
      'https://images.unsplash.com/photo-1523362628744-4cdd3d3cc0f8', // Bottle
      'https://images.unsplash.com/photo-1593095191848-267332494bc2', // Protein
      'https://images.unsplash.com/photo-1555861496-0666c8981751', // Towel
      'https://images.unsplash.com/photo-1598283109113-228cc7477703', // Band
      'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5', // Kettlebell
      'https://images.unsplash.com/photo-1576243345690-4e4b79b63288', // Tracker
      'https://images.unsplash.com/photo-1518611012118-29fa11bcd050', // Foam roller
      'https://images.unsplash.com/photo-1553062407-98eeb94c6a62'  // Gym bag
    ],
    statuses: [
      'https://images.unsplash.com/photo-1517836357463-d25dfeac3438',
      'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b',
      'https://images.unsplash.com/photo-1518611012118-29fa11bcd050',
      'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b',
      'https://images.unsplash.com/photo-1574680096145-d05b474e2155',
      'https://images.unsplash.com/photo-1599058917232-d750cda224e7',
      'https://images.unsplash.com/photo-1594882645126-14020914d58d'
    ]
  },
  Art: {
    products: [
      'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5', // Painting
      'https://images.unsplash.com/photo-1554188248-986adbb73be4', // Sculpture
      'https://images.unsplash.com/photo-1578749553376-4740f955d761', // Pottery
      'https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3', // Print
      'https://images.unsplash.com/photo-1580136608260-42d1c4701874', // Easel
      'https://images.unsplash.com/photo-1541963463532-d68292c34b19', // Canvas
      'https://images.unsplash.com/photo-1513364776144-60967b0f800f', // Brush set
      'https://images.unsplash.com/photo-1565193998772-263d8ff4afdf', // Clay kit
      'https://images.unsplash.com/photo-1577083552431-6e5fd01aa342', // Framing
      'https://images.unsplash.com/photo-1544816155-12df9643f363'  // Sketchbook
    ],
    statuses: [
      'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b',
      'https://images.unsplash.com/photo-1459908676235-d5f02a50184b',
      'https://images.unsplash.com/photo-1513364776144-60967b0f800f',
      'https://images.unsplash.com/photo-1499781350541-7783f6c6a0c8',
      'https://images.unsplash.com/photo-1547826039-bfc35e0f1ea8',
      'https://images.unsplash.com/photo-1541963463532-d68292c34b19',
      'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5'
    ]
  },
  Gourmet: {
    products: [
      'https://images.unsplash.com/photo-1511381939415-e44015466834', // Chocolate
      'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085', // Coffee
      'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5', // Olive oil
      'https://images.unsplash.com/photo-1587049352846-4a222e784d38', // Honey
      'https://images.unsplash.com/photo-1486297678162-ad2a19b058fb', // Cheese
      'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3', // Wine
      'https://images.unsplash.com/photo-1532336414038-cf19250c5757', // Spices
      'https://images.unsplash.com/photo-1551183053-bf91a1d81141', // Pasta
      'https://images.unsplash.com/photo-1571934811356-5cc561b6821f', // Tea
      'https://images.unsplash.com/photo-1589923188900-85dae523342b'  // Jam
    ],
    statuses: [
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836',
      'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1',
      'https://images.unsplash.com/photo-1490645935967-10de6ba17051',
      'https://images.unsplash.com/photo-1504754524776-8f4f37790ca0',
      'https://images.unsplash.com/photo-1512621776951-a57141f2eefd',
      'https://images.unsplash.com/photo-1473093226795-af9932fe5856',
      'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe'
    ]
  }
};

const vendorData = [
  { name: 'Aura Tech Solutions', email: 'contact@auratech.io', storeName: 'Aura Tech', category: 'Electronics' },
  { name: 'Luxe Wear Boutique', email: 'info@luxewear.com', storeName: 'Luxe Wear', category: 'Fashion' },
  { name: 'Zenith Home Decor', email: 'hello@zenithhome.com', storeName: 'Zenith Home', category: 'Home' },
  { name: 'Glow Beauty Labs', email: 'support@glowbeauty.io', storeName: 'Glow Beauty', category: 'Beauty' },
  { name: 'Pure Pulse Wellness', email: 'pure@pulsewellness.com', storeName: 'Pure Pulse', category: 'Wellness' },
  { name: 'Canvas & Clay Art', email: 'art@canvasclay.com', storeName: 'Canvas & Clay', category: 'Art' },
  { name: 'Epicurean Bites', email: 'tasty@epicureanbites.com', storeName: 'Epicurean', category: 'Gourmet' }
];

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // 1. Clean data for these vendors to avoid massive duplication
    const emails = vendorData.map(v => v.email);
    const usersToDelete = await User.find({ email: { $in: emails } });
    const userIds = usersToDelete.map(u => u._id);
    const vendorsToDelete = await Vendor.find({ user_id: { $in: userIds } });
    const vendorIds = vendorsToDelete.map(v => v._id);

    await Product.deleteMany({ vendor_id: { $in: vendorIds } });
    await Status.deleteMany({ vendor_id: { $in: vendorIds } });
    await Store.deleteMany({ vendor_id: { $in: vendorIds } });
    await Vendor.deleteMany({ _id: { $in: vendorIds } });
    await User.deleteMany({ _id: { $in: userIds } });

    console.log('Cleaned existing seed data.');

    for (const vInfo of vendorData) {
      console.log(`Seeding ${vInfo.storeName}...`);
      const catData = categories[vInfo.category];
      
      const user = new User({
        name: vInfo.name, email: vInfo.email, password: 'Password123!', role: 'vendor',
        avatar: `${catData.products[0]}?w=200&h=200&fit=crop`,
        branding: { logo: `${catData.products[0]}?w=200&h=200&fit=crop`, banner: `${catData.statuses[0]}?w=1200&h=400&fit=crop` },
        onboarded: true, verification_status: 'verified'
      });
      await user.save();

      const vendor = new Vendor({
        user_id: user._id, store_name: vInfo.storeName, verified: true, subscription_plan: 'elite',
        rating: 4.8 + Math.random() * 0.2, follower_count: Math.floor(Math.random() * 5000) + 1000, phone: '+237600000000'
      });
      await vendor.save();

      await new Store({ vendor_id: vendor._id, logo: user.branding.logo, banner: user.branding.banner, categories: [vInfo.category] }).save();

      const products = [];
      for (let i = 0; i < 10; i++) {
        const p = new Product({
          vendor_id: vendor._id, name: `${vInfo.category} Essential ${i + 1}`,
          description: `Premium quality ${vInfo.category} item for the modern home.`,
          price: Math.floor(Math.random() * 50000) + 5000, category: vInfo.category, stock: 50,
          images: [{ url: `${catData.products[i]}?w=600&q=80&auto=format` }],
          status: 'active', featured: i < 2
        });
        await p.save();
        products.push(p);
      }

      for (let j = 0; j < 7; j++) {
        const type = j % 3 === 0 ? 'video' : (j % 3 === 1 ? 'image' : 'text');
        await new Status({
          vendor_id: vendor._id, type,
          content_url: type === 'text' ? null : `${catData.statuses[j]}?w=800&q=70&auto=format`,
          text_content: type === 'text' ? `Discover the new ${vInfo.category} collection at ${vInfo.storeName}!` : '',
          caption: `New ${vInfo.category} drop! ✨`, linked_product: products[j % 10]._id,
          expires_at: new Date(Date.now() + (j + 1) * 24 * 60 * 60 * 1000),
          views_count: Math.floor(Math.random() * 1000) + 100, likes_count: Math.floor(Math.random() * 200) + 20
        }).save();
      }
      console.log('Seeding 5 variable products...');
      const varVendor = vendor; // Use the last created vendor for simplicity or pick one
      const varProducts = [
        {
          name: 'Signature Variable Sneakers',
          cat: 'Fashion',
          types: [{ name: 'Size', options: ['40', '42', '44'] }, { name: 'Color', options: ['Midnight Black', 'Electric Blue'] }],
          img: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff'
        },
        {
          name: 'Pro Tech Smartphone',
          cat: 'Electronics',
          types: [{ name: 'Storage', options: ['128GB', '256GB', '512GB'] }, { name: 'Color', options: ['Graphite', 'Silver'] }],
          img: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9'
        },
        {
          name: 'Artisan Coffee Blend',
          cat: 'Gourmet',
          types: [{ name: 'Roast', options: ['Light', 'Medium', 'Dark'] }, { name: 'Weight', options: ['250g', '500g'] }],
          img: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085'
        },
        {
          name: 'Zenith Modular Sofa',
          cat: 'Home',
          types: [{ name: 'Fabric', options: ['Linen', 'Velvet'] }, { name: 'Sections', options: ['2-Seater', '3-Seater'] }],
          img: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc'
        },
        {
          name: 'Pure Pulse Yoga Set',
          cat: 'Wellness',
          types: [{ name: 'Size', options: ['S', 'M', 'L'] }, { name: 'Style', options: ['Minimal', 'Floral'] }],
          img: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b'
        }
      ];

      for (const vp of varProducts) {
        const product = new Product({
          vendor_id: varVendor._id,
          name: vp.name,
          description: `Versatile ${vp.cat} item with multiple options to suit your style.`,
          price: 25000, // Base price
          category: vp.cat,
          stock: 100,
          images: [{ url: `${vp.img}?w=600&q=80&auto=format` }],
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
          price: 20000 + (idx * 2000),
          stock: 5 + Math.floor(Math.random() * 20),
          sku: `SKU-${vp.name.slice(0,3).toUpperCase()}-${idx}`,
          image: `${vp.img}?w=600&q=80&auto=format&sig=${idx}`
        }));

        await product.save();
      }
    }

    console.log('Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

seed();
