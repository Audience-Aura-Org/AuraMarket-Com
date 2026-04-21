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
    let match = { expires_at: { $gt: now } };

    // Discovery Mode: Only followed vendors
    if (mode === 'followed') {
      const followed = await Follow.find({ user_id: req.user.id }).select('vendor_id');
      const vendorIds = followed.map(f => f.vendor_id);
      match.vendor_id = { $in: vendorIds };
    }

    let sortOption = { createdAt: -1 };
    let aggregation = [{ $match: match }];

    if (mode === 'global') {
      if (sort === 'trending') {
        // Decay Score: Likes / (HoursSincePost + 2)
        aggregation.push({
          $addFields: {
            hoursSincePost: {
              $divide: [{ $subtract: [now, "$createdAt"] }, 3600000]
            }
          }
        });
        aggregation.push({
          $addFields: {
            score: {
              $divide: ["$likes_count", { $add: ["$hoursSincePost", 2] }]
            }
          }
        });
        sortOption = { score: -1, createdAt: -1 };
      } else if (sort === 'new') {
        sortOption = { createdAt: -1 };
      } else if (sort === 'popular') {
        sortOption = { likes_count: -1, createdAt: -1 };
      }
    }

    aggregation.push({ $sort: sortOption });
    aggregation.push({ $skip: (Number(page) - 1) * Number(limit) });
    aggregation.push({ $limit: Number(limit) });

    // Populate vendor info
    const statuses = await Status.aggregate(aggregation);
    
    // We need to hydrate the models to use populate or do it manually
    const hydrated = await Status.populate(statuses, [
      { path: 'vendor_id', select: 'store_name user_id' },
      { path: 'vendor_id', populate: { path: 'user_id', select: 'avatar branding' } }
    ]);

    res.status(200).json({ success: true, count: hydrated.length, data: hydrated });
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
    const status = await Status.findById(req.params.id);
    if (!status) return res.status(404).json({ success: false, message: 'Status not found' });

    // Mark as viewed if not already
    // Use atomic update to prevent document size explosion and race conditions
    await Status.findByIdAndUpdate(req.params.id, {
      $inc: { views_count: 1 },
      $addToSet: { viewer_ids: req.user.id }
    });

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
