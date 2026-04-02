const Category = require('../models/Category.model');
const Product = require('../models/Product.model');

// @desc    Get all categories with popularity metrics
exports.getAllCategories = async (req, res) => {
  try {
    // 1. Get all active categories
    const categories = await Category.find({ is_active: true })
      .select('name parent_id slug icon')
      .lean();

    // 2. Aggregate metrics from products
    // Note: Product.category is currently a string (name) in the model, but we should match carefully
    const metrics = await Product.aggregate([
      { $match: { status: 'active' } },
      { $group: {
          _id: "$category",
          product_count: { $sum: 1 },
          total_views: { $sum: "$view_count" }
      }}
    ]);

    // 3. Map metrics back to categories
    const categoryList = categories.map(cat => {
      const metric = metrics.find(m => m._id?.toLowerCase() === cat.name.toLowerCase());
      return {
        ...cat,
        product_count: metric?.product_count || 0,
        total_views: metric?.total_views || 0
      };
    });

    // 4. Sort: Most Visited DESC, then Most Products DESC
    categoryList.sort((a, b) => {
      if (b.total_views !== a.total_views) return b.total_views - a.total_views;
      return b.product_count - a.product_count;
    });

    res.status(200).json({ success: true, data: categoryList });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Get hierarchical tree filtered to only categories with products (for shop sidebar)
exports.getCategoriesWithProducts = async (req, res) => {
  try {
    // 1. Get all active categories at once
    const allCategories = await Category.find({ is_active: true }).sort('name').lean();
    
    // 2. Get distinct categories that have active products
    const productCategoryNames = await Product.distinct('category', { status: 'active' });
    const productCatSet = new Set(productCategoryNames.map(c => c?.toLowerCase()));

    // 3. Map categories for quick lookup
    const catMap = {};
    allCategories.forEach(cat => {
      catMap[cat._id] = { 
        ...cat, 
        children: [], 
        hasProducts: productCatSet.has(cat.name?.toLowerCase()) 
      };
    });

    // 4. Build hierarchy and connect children
    const roots = [];
    allCategories.forEach(cat => {
      const node = catMap[cat._id];
      if (cat.parent_id && catMap[cat.parent_id]) {
        catMap[cat.parent_id].children.push(node);
      } else if (!cat.parent_id) {
        roots.push(node);
      }
    });

    // 5. Bubble up 'hasProducts' status (recursively check children)
    const bubbleHasProducts = (node) => {
      let childrenHaveProducts = false;
      for (const child of node.children) {
        if (bubbleHasProducts(child)) {
          childrenHaveProducts = true;
        }
      }
      node.hasProducts = node.hasProducts || childrenHaveProducts;
      return node.hasProducts;
    };

    roots.forEach(bubbleHasProducts);

    // 6. Clean the tree to only include nodes with products
    const pruneTree = (nodes) => {
      return nodes
        .filter(n => n.hasProducts)
        .map(n => ({
          ...n,
          children: pruneTree(n.children)
        }));
    };

    const tree = pruneTree(roots);
    res.status(200).json({ success: true, data: tree });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Get hierarchical tree (for admin management)
exports.getCategoryTree = async (req, res) => {
  try {
    const categories = await Category.find({ is_active: true }).sort('order name');

    const buildTree = (items, parentId = null) => {
      return items
        .filter(item => String(item.parent_id) === String(parentId))
        .map(item => ({
          ...item._doc,
          children: buildTree(items, item._id)
        }));
    };

    const tree = buildTree(categories, null);
    res.status(200).json({ success: true, data: tree });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Get children of a specific category (for drill-down)
exports.getCategoryChildren = async (req, res) => {
  try {
    const { parentId } = req.params;
    const categories = await Category.find({ 
      parent_id: parentId === 'null' ? null : parentId, 
      is_active: true 
    }).sort('name');
    res.status(200).json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Create category (Admin only)
exports.createCategory = async (req, res) => {
  try {
    const { name, parent_id, slug, icon, description } = req.body;
    const category = await Category.create({ 
      name, 
      parent_id: parent_id || null, 
      slug: slug || name.toLowerCase().replace(/ /g, '-'),
      icon,
      description
    });
    res.status(201).json({ success: true, data: category });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// @desc    Update category (Admin only)
exports.updateCategory = async (req, res) => {
  try {
    const category = await Category.findByIdAndUpdate(req.params.id, req.body, {
      returnDocument: 'after',
      runValidators: true
    });
    if (!category) return res.status(404).json({ success: false, error: 'Not found' });
    res.status(200).json({ success: true, data: category });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// @desc    Delete category (Admin only)
exports.deleteCategory = async (req, res) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) return res.status(404).json({ success: false, error: 'Not found' });
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};
