require('dotenv').config();

const mongoose = require('mongoose');
const Product = require('../models/Product.model');

const shouldApply = process.argv.includes('--apply');

const run = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not defined.');
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 15000,
    heartbeatFrequencyMS: 10000,
    family: 4,
  });

  const products = await Product.find({
    has_variants: true,
    'sku_variants.0': { $exists: true },
  }).select('name price sku_variants');

  let scanned = 0;
  let changed = 0;
  let variantsChanged = 0;

  for (const product of products) {
    scanned += 1;
    const basePrice = Number(product.price || 0);
    let touched = false;

    product.sku_variants.forEach((variant) => {
      if (Number(variant.price || 0) !== basePrice) {
        variantsChanged += 1;
        touched = true;
        if (shouldApply) variant.price = basePrice;
      }
    });

    if (touched) {
      changed += 1;
      console.log(`${shouldApply ? 'SYNC' : 'DRY'} ${product._id} "${product.name}" -> ${basePrice} XAF`);
      if (shouldApply) {
        product.markModified('sku_variants');
        await product.save();
      }
    }
  }

  console.log(JSON.stringify({
    mode: shouldApply ? 'apply' : 'dry-run',
    products_scanned: scanned,
    products_with_mismatched_variants: changed,
    variants_changed: shouldApply ? variantsChanged : 0,
    variants_that_would_change: shouldApply ? 0 : variantsChanged,
  }, null, 2));

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error(error.message);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
