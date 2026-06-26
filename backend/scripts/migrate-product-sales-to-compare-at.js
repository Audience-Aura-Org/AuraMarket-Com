require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/Product.model');

const run = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI environment variable is not defined.');
    process.exit(1);
  }

  console.log('Connecting to database...');
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 15000,
    family: 4,
  });
  console.log('Connected to MongoDB.');

  const products = await Product.find({});
  console.log(`Found ${products.length} products to check/migrate.`);

  let migratedCount = 0;
  for (const product of products) {
    let touched = false;
    const oldPrice = Number(product.price || 0);
    const oldSalePrice = product.sale_price !== null && product.sale_price !== undefined ? Number(product.sale_price) : null;

    if (oldSalePrice !== null && oldSalePrice > 0 && oldSalePrice < oldPrice) {
      console.log(`⚡ Migrating sale price for product: "${product.name}" (${product._id})`);
      console.log(`   Old Price: ${oldPrice} XAF, Old Sale Price: ${oldSalePrice} XAF`);
      
      product.compare_at_price = oldPrice;
      product.price = oldSalePrice;
      product.sale_price = null;
      product.on_sale = true;
      touched = true;

      if (product.has_variants && product.sku_variants && product.sku_variants.length > 0) {
        console.log(`   Migrating ${product.sku_variants.length} SKU variants...`);
        product.sku_variants.forEach(variant => {
          const vPrice = Number(variant.price || 0);
          if (vPrice === oldPrice) {
            console.log(`     Updating variant combo: ${JSON.stringify(variant.combination)}: price ${vPrice} -> ${oldSalePrice}, compare_at_price -> ${oldPrice}`);
            variant.compare_at_price = oldPrice;
            variant.price = oldSalePrice;
          } else {
            variant.compare_at_price = null;
          }
        });
        product.markModified('sku_variants');
      }
    } else {
      // Ensure compare_at_price is initialized to null if not already set, and clear sale_price
      if (product.compare_at_price === undefined) {
        product.compare_at_price = null;
        touched = true;
      }
      if (product.sale_price !== null && product.sale_price !== undefined) {
        product.sale_price = null;
        touched = true;
      }
      if (product.has_variants && product.sku_variants && product.sku_variants.length > 0) {
        let variantsTouched = false;
        product.sku_variants.forEach(variant => {
          if (variant.compare_at_price === undefined) {
            variant.compare_at_price = null;
            variantsTouched = true;
          }
        });
        if (variantsTouched) {
          product.markModified('sku_variants');
          touched = true;
        }
      }
    }

    if (touched) {
      await product.save();
      migratedCount++;
    }
  }

  console.log(`Migration complete! Successfully migrated/updated ${migratedCount} products.`);
  await mongoose.disconnect();
  console.log('Database disconnected.');
};

run().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
