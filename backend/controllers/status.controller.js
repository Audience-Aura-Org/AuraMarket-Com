const Status = require('../models/Status.model');
const Vendor = require('../models/Vendor.model');
const Follow = require('../models/Follow.model');
const Notification = require('../models/Notification.model');
const { deleteS3ObjectByUrl } = require('../utils/s3');

// @desc    Create a new status
// @route   POST /api/statuses
// @access  Private (Vendor only)
exports.createStatus = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ user_id: req.user._id || req.user.id });
    if (!vendor) {
      return res.status(403).json({ success: false, message: 'Only vendors can post statuses' });
    }

    const { type, content_url, thumbnail_url, text_content, linked_product, caption, category, expires_at, expiry_days } = req.body;

    const expiresAt = expires_at
      ? new Date(expires_at)
      : new Date(Date.now() + (expiry_days || 1) * 24 * 60 * 60 * 1000);

    const status = await Status.create({
      vendor_id: vendor._id,
      type,
      content_url,
      thumbnail_url,
      text_content,
      linked_product: linked_product || null,
      caption,
      category: category || 'Moment',
      expiry_days: expiry_days || 1,
      expires_at: expiresAt,
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
    const { mode = 'global', sort = 'trending', category, page = 1, limit = 40 } = req.query;
    const now = new Date();
    const query = { expires_at: { $gt: now } };

    if (category && category !== 'All') {
      query.category = category;
    }

    // Followed-only mode: scope to followed vendors
    if (mode === 'followed') {
      if (!req.user) {
        return res.status(200).json({ success: true, count: 0, data: [] });
      }
      const followed = await Follow.find({ user_id: req.user._id || req.user.id }).select('vendor_id').lean();
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
      .populate({
        path: 'linked_product',
        select: 'name price sale_price on_sale images'
      })
      .lean();

    const userId = req.user?._id || req.user?.id;
    const formattedStatuses = statuses.map(s => {
      const viewerIds = s.viewer_ids || [];
      const isViewed = userId ? viewerIds.some(id => id.toString() === userId.toString()) : false;
      return {
        ...s,
        isViewed
      };
    });

    res.status(200).json({ success: true, count: formattedStatuses.length, data: formattedStatuses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get one active status for shared story links
// @route   GET /api/statuses/story/:id
// @access  Public/Optional auth
exports.getStatusById = async (req, res) => {
  try {
    const status = await Status.findOne({
      _id: req.params.id,
      expires_at: { $gt: new Date() },
    })
      .populate({
        path: 'vendor_id',
        select: 'store_name logo_url user_id rating average_rating total_reviews',
        populate: { path: 'user_id', select: 'name avatar' },
      })
      .populate({
        path: 'linked_product',
        select: 'name price sale_price on_sale images',
      })
      .lean();

    if (!status) {
      return res.status(404).json({ success: false, message: 'Story not found or expired' });
    }

    const userId = req.user?._id || req.user?.id;
    const viewerIds = status.viewer_ids || [];
    const isViewed = userId ? viewerIds.some(id => id.toString() === userId.toString()) : false;

    res.status(200).json({ success: true, data: { ...status, isViewed } });
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
    const userId = req.user._id || req.user.id;
    const index = status.reactions.findIndex(r => r.user_id.toString() === userId.toString());
    
    if (index === -1) {
      status.reactions.push({ user_id: userId });
      
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

        // 🔥 Real-time Update to Vendor
        const io = req.app.get('io');
        if (io) {
          io.to(vendor.user_id.toString()).emit('status_update', { 
            status_id: status._id.toString(), 
            type: 'like', 
            count: status.reactions.length 
          });
        }
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
      update.$addToSet = { viewer_ids: req.user._id || req.user.id };
    }

    // Respond immediately — don't block on socket/vendor lookup
    const updatedStatus = await Status.findByIdAndUpdate(req.params.id, update, { returnDocument: 'after' });
    res.status(200).json({ success: true });

    // 🔥 Fire-and-forget: emit real-time update to vendor after responding
    if (updatedStatus) {
      Vendor.findById(updatedStatus.vendor_id).then(vendor => {
        if (!vendor) return;
        const io = req.app.get('io');
        if (io) {
          io.to(vendor.user_id.toString()).emit('status_update', {
            status_id: updatedStatus._id.toString(),
            type: 'view',
            count: updatedStatus.views_count
          });
        }
      }).catch(() => {});
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get my statuses (Vendor Dashboard)
// @route   GET /api/statuses/my-statuses
// @access  Private (Vendor)
exports.getMyStatuses = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ user_id: req.user._id || req.user.id });
    if (!vendor) return res.status(403).json({ success: false, message: 'Vendor profile required' });

    const statuses = await Status.find({ vendor_id: vendor._id })
      .sort({ createdAt: -1 })
      .populate({
        path: 'linked_product',
        select: 'name price sale_price on_sale images'
      });

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
    const vendor = await Vendor.findOne({ user_id: req.user._id || req.user.id });
    const status = await Status.findById(req.params.id);

    if (!status) return res.status(404).json({ success: false, message: 'Status not found' });
    if (status.vendor_id.toString() !== vendor?._id?.toString()) {
      return res.status(401).json({ success: false, message: 'Not authorized to delete this status' });
    }

    await status.deleteOne();
    if (status.content_url) {
      deleteS3ObjectByUrl(status.content_url).catch((err) => {
        console.warn(`[Status] Temporary media cleanup failed for ${status._id}: ${err.message}`);
      });
    }
    if (status.thumbnail_url) {
      deleteS3ObjectByUrl(status.thumbnail_url).catch((err) => {
        console.warn(`[Status] Temporary thumbnail cleanup failed for ${status._id}: ${err.message}`);
      });
    }
    res.status(200).json({ success: true, message: 'Status removed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
