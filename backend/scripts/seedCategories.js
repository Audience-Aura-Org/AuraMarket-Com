const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');
const Category = require('../models/Category.model');

dotenv.config();

const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
};

const importCategories = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/aura-market');
    console.log('Connected to MongoDB');

    // Clear existing categories
    await Category.deleteMany({});
    console.log('Cleared existing categories');

    const data = JSON.parse(fs.readFileSync('../hierarchical_categories.json', 'utf8'));

    const processCategory = async (cat, parentId = null) => {
      const baseSlug = slugify(cat.name);
      let slug = baseSlug;
      let counter = 1;
      
      // Ensure unique slug
      while (await Category.findOne({ slug })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      const newCat = await Category.create({
        name: cat.name,
        parent_id: parentId,
        slug: slug
      });

      if (cat.children && cat.children.length > 0) {
        for (const child of cat.children) {
          await processCategory(child, newCat._id);
        }
      }
    };

    for (const cat of data) {
      await processCategory(cat);
    }

    console.log('Import successful');
    process.exit();
  } catch (err) {
    console.error('Import failed:', err);
    process.exit(1);
  }
};

importCategories();
