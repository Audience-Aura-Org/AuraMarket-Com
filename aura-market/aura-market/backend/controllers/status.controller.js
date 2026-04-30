const Status = require('../models/Status.model');
const Vendor = require('../models/Vendor.model');
const Follow = require('../models/Follow.model');
const Notification = require('../models/Notification.model');

// @desc    Create a new status
// @route   POST /api/statuses
// @access  Private (Vendor only)
exports.createStatus = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ user_id: req.user.id });
    if (!vendor) {
      return res.status(403).json({ success: false, message: 'Only vendors can post statuses' });
    }

    const { type, content_url, text_content, linked_product, caption } = req.body;

    const status = await Status.create({
      vendor_id: vendor._id,
      type,
      content_url,
      text_content,
      linked_product,
      caption,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });

    res.status(201).json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get active statuses
// @route   GET /api/statuses
// @access  Private
exports.getActiveStatuses = async (req, res) => {
  try {
    const { mode = 'global', sort = 'trending', page = 1, limit = 20 } = req.query;
    const now = new Date();
    const query = { expires_at: { $gt: now } };

    // Followed-only mode: scope to followed vendors
    if (mode === 'followed') {
      if (!req.user) {
        return res.status(200).json({ success: true, count: 0, data: [] });
      }
      const followed = await Follow.find({ user_id: req.user.id }).select('vendor_id').lean();
      query.vendor_id = { $in: followed.map(f => f.vendor_id) };
    }

    // Sort
    let sortOption;
    switch (sort) {
      case 'new':     sortOption = { createdAt: -1 }; break;
      case 'popular': sortOption = { likes_count: -1, createdAt: -1 }; break;
      default:        sortOption = { likes_count: -1, createdAt: -1 }; break; // trending fallback
    }

    const statuses = await Status.find(query)
      .sort(sortOption)
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .populate({
        path: 'vendor_id',
        select: 'store_name user_id',
        populate: { path: 'user_id', select: 'avatar branding' }
      })
      .lean();

    res.status(200).json({ success: true, count: statuses.length, data: statuses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    React (Like) a status
// @route   POST /api/statuses/:id/react
// @access  Private
exports.reactToStatus = async (req, res) => {
  try {
    const status = await Status.findById(req.params.id);
    if (!status) return res.status(404).json({ success: false, message: 'Status not found' });

    // Check if already reacted
    const index = status.reactions.findIndex(r => r.user_id.toString() === req.user.id);
    
    if (index === -1) {
      status.reactions.push({ user_id: req.user.id });
      
      // Notify Vendor (once per reaction)
      const vendor = await Vendor.findById(status.vendor_id);
      if (vendor) {
        await Notification.create({
          recipient: vendor.user_id,
          title: 'New Status Reaction ❤️',
          message: `${req.user.name} liked your status update!`,
          type: 'vendor_update',
          metadata: { target_id: status._id, link: `/dashboard/statuses` }
        });
      }
    } else {
      status.reactions.splice(index, 1); // Unlike
    }

    await status.save();
    res.status(200).json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Mark status as viewed
// @route   POST /api/statuses/:id/view
// @access  Private
exports.viewStatus = async (req, res) => {
  try {
    const update = { $inc: { views_count: 1 } };
    if (req.user) {
      update.$addToSet = { viewer_ids: req.user.id };
    }
    
    await Status.updateOne({ _id: req.params.id }, update);
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get my statuses (Vendor Dashboard)
// @route   GET /api/statuses/my-statuses
// @access  Private (Vendor)
exports.getMyStatuses = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ user_id: req.user.id });
    if (!vendor) return res.status(403).json({ success: false, message: 'Vendor profile required' });

    const statuses = await Status.find({ vendor_id: vendor._id })
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: statuses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete status
// @route   DELETE /api/statuses/:id
// @access  Private (Vendor Owner)
exports.deleteStatus = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ user_id: req.user.id });
    const status = await Status.findById(req.params.id);

    if (!status) return res.status(404).json({ success: false, message: 'Status not found' });
    if (status.vendor_id.toString() !== vendor?._id?.toString()) {
      return res.status(401).json({ success: false, message: 'Not authorized to delete this status' });
    }

    await status.deleteOne();
    res.status(200).json({ success: true, message: 'Status removed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
