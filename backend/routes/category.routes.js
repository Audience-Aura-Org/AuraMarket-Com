const express = require('express');
const router = express.Router();
const { 
  getAllCategories, 
  getCategoryTree, 
  getCategoryChildren,
  getCategoriesWithProducts,
  createCategory,
  updateCategory,
  deleteCategory
} = require('../controllers/Category.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');

// Public routes
router.get('/', getAllCategories);
router.get('/tree', getCategoryTree);
router.get('/with-products', getCategoriesWithProducts);
router.get('/children/:parentId', getCategoryChildren);

// Protected Admin routes
router.post('/', protect, restrictTo('admin', 'manager'), createCategory);
router.put('/:id', protect, restrictTo('admin', 'manager'), updateCategory);
router.delete('/:id', protect, restrictTo('admin', 'manager'), deleteCategory);

module.exports = router;
