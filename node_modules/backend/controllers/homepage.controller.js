/**
 * controllers/homepage.controller.js
 * Aura Market — Storefront & Homepage Management
 */

const HomepageSection = require('../models/HomepageSection.model');
const Product = require('../models/Product.model');
const Vendor = require('../models/Vendor.model');

/**
 * @route   GET /api/v1/homepage
 * @desc    Get the current dynamic homepage layout
 * @access  Public
 */
const getHomepage = async (req, res, next) => {
  try {
    const now = new Date();
    console.log('[homepage] GET /api/v1/homepage - fetching sections at', now.toISOString());
    
    // Fetch active sections within their scheduled dates
    const sections = await HomepageSection.find({
      is_active: true,
      $and: [
        { $or: [{ scheduled_start: { $lte: now } }, { scheduled_start: null }, { scheduled_start: { $exists: false } }] },
        { $or: [{ scheduled_end: { $gte: now } }, { scheduled_end: null }, { scheduled_end: { $exists: false } }] }
      ]
    })
    .sort({ order: 1 })
    .populate({
      path: 'data.product_id',
      select: 'name price images rating stock vendor_id view_count purchase_count',
      populate: { 
        path: 'vendor_id', 
        select: 'store_name user_id',
        populate: { path: 'user_id', select: 'avatar branding' }
      }
    })
    .populate({
      path: 'data.vendor_id',
      select: 'store_name description rating verified user_id',
      populate: { path: 'store user_id', select: 'logo banner branding avatar' }
    });
    console.log('[homepage] fetched sections count:', sections.length);

    res.status(200).json({
      success: true,
      count: sections.length,
      data: { sections }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/admin/homepage-section
 * @desc    Create a new homepage section
 * @access  Private (Admin)
 */
const createSection = async (req, res, next) => {
  try {
    const section = await HomepageSection.create(req.body);
    res.status(201).json({ success: true, data: { section } });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/v1/admin/homepage-section/:id
 * @desc    Update an existing homepage section
 * @access  Private (Admin)
 */
const updateSection = async (req, res, next) => {
  try {
    const section = await HomepageSection.findByIdAndUpdate(
      req.params.id,
      req.body,
      { returnDocument: 'after', runValidators: true }
    );
    
    if (!section) return res.status(404).json({ success: false, message: 'Section not found' });
    
    res.status(200).json({ success: true, data: { section } });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/v1/admin/homepage-section/:id
 * @desc    Delete a homepage section
 * @access  Private (Admin)
 */
const deleteSection = async (req, res, next) => {
  try {
    const section = await HomepageSection.findByIdAndDelete(req.params.id);
    if (!section) return res.status(404).json({ success: false, message: 'Section not found' });
    
    res.status(200).json({ success: true, message: 'Section removed' });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/v1/admin/homepage-section/reorder
 * @desc    Reorder multiple sections at once
 * @access  Private (Admin)
 */
const reorderSections = async (req, res, next) => {
  try {
    const { orders } = req.body; // Array of { id, order }
    
    const updates = orders.map(item => 
      HomepageSection.findByIdAndUpdate(item.id, { order: item.order })
    );
    
    await Promise.all(updates);
    
    res.status(200).json({ success: true, message: 'Homepage reordered successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/homepage/admin/sections
 * @desc    Get all sections for admin (includes inactive/scheduled)
 * @access  Private (Admin)
 */
const getAdminSections = async (req, res, next) => {
  try {
    const sections = await HomepageSection.find()
      .sort({ order: 1 })
      .populate({
        path: 'data.product_id',
        select: 'name price images rating stock vendor_id view_count purchase_count',
        populate: { 
          path: 'vendor_id', 
          select: 'store_name user_id',
          populate: { path: 'user_id', select: 'avatar branding' }
        }
      })
      .populate({
        path: 'data.vendor_id',
        select: 'store_name description rating verified user_id',
        populate: [
          { path: 'store', select: 'logo banner' },
          { path: 'user_id', select: 'avatar branding' }
        ]
      });

    res.status(200).json({
      success: true,
      count: sections.length,
      data: { sections }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getHomepage,
  getAdminSections,
  createSection,
  updateSection,
  deleteSection,
  reorderSections
};
