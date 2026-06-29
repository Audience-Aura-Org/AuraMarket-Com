const Status = require('../models/Status.model');
const Vendor = require('../models/Vendor.model');
const Follow = require('../models/Follow.model');
const Notification = require('../models/Notification.model');
const { deleteS3ObjectByUrl } = require('../utils/s3');
const { getSubscriptionStatus } = require('../services/subscription.service');

const STATUS_STORY_SELECT = [
  '_id',
  'vendor_id',
  'type',
  'content_url',
  'thumbnail_url',
  'text_content',
  'linked_product',
  'caption',
  'category',
  'expires_at',
  'views_count',
  'likes_count',
  'createdAt',
  'segment_start',
  'segment_end',
  'segment_index',
  'segment_count',
  'viewer_ids',
].join(' ');

const STATUS_VENDOR_POPULATE = {
  path: 'vendor_id',
  select: 'store_name verified user_id',
  populate: { path: 'user_id', select: 'avatar branding' },
};

const STATUS_LINKED_PRODUCT_POPULATE = {
  path: 'linked_product',
  select: 'name price sale_price images',
};

const formatStatusPayload = (status, userId = null) => {
  if (!status) return status;

  const viewerIds = Array.isArray(status.viewer_ids) ? status.viewer_ids : [];
  const isViewed = userId
    ? viewerIds.some((id) => id?.toString() === userId.toString())
    : false;

  const { viewer_ids, ...rest } = status;
  return {
    ...rest,
    isViewed,
  };
};

// @desc    Create a new status
// @route   POST /api/statuses
// @access  Private (Vendor only)
exports.createStatus = async (req, res) => {
  try {
    // 1. CRITICAL: Check subscription explicitly with detailed error message
    // This prevents generic 402 responses and ensures proper error context for mobile
    const subscriptionStatus = await getSubscriptionStatus(req.user, 'vendor');
    if (!subscriptionStatus.active) {
      console.warn('[STATUS_CREATE] Subscription check failed', {
        userId: req.user._id,
        role: 'vendor',
        subscriptionState: subscriptionStatus.access_state,
      });
      return res.status(402).json({
        success: false,
        code: 'SUBSCRIPTION_REQUIRED',
        message: 'Vendors must have an active subscription to create statuses.',
        subscription: subscriptionStatus,
      });
    }

    // 2. Look up vendor using standardized _id field
    // Using only _id ensures consistent behavior across mobile and desktop
    const vendor = await Vendor.findOne({ user_id: req.user._id });
    if (!vendor) {
      console.warn('[STATUS_CREATE] Vendor not found', {
        userId: req.user._id,
        userName: req.user.name,
      });
      return res.status(403).json({
        success: false,
        message: 'Vendor profile not found. Complete vendor onboarding first.',
        code: 'VENDOR_NOT_FOUND',
      });
    }

    const {
      type,
      content_url,
      thumbnail_url,
      text_content,
      linked_product,
      caption,
      category,
      expires_at,
      expiry_days,
      segment_start,
      segment_end,
      segment_index,
      segment_count,
    } = req.body;
    const segmentStart = Math.max(0, Number(segment_start) || 0);
    const rawSegmentEnd = Number(segment_end);
    const segmentEnd = Number.isFinite(rawSegmentEnd) && rawSegmentEnd > segmentStart ? rawSegmentEnd : null;
    const segmentIndex = Math.max(0, Number(segment_index) || 0);
    const segmentCount = Math.max(1, Number(segment_count) || 1);

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
      segment_start: segmentStart,
      segment_end: segmentEnd,
      segment_index: Math.min(segmentIndex, segmentCount - 1),
      segment_count: segmentCount,
    });

    res.status(201).json({ success: true, data: status });
  } catch (error) {
    // Log detailed error context for mobile debugging
    console.error('[STATUS_CREATE_ERROR]', {
      userId: req.user?._id,
      endpoint: 'POST /api/statuses',
      errorMessage: error.message,
      errorCode: error.code,
      timestamp: new Date().toISOString(),
    });
    
    res.status(500).json({
      success: false,
      message: error.message,
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
    });
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
    const pageNumber = Math.max(1, Number(page) || 1);
    const pageLimit = Math.min(50, Math.max(1, Number(limit) || 40));

    if (category && category !== 'All') {
      query.category = category;
    }

    // Followed-only mode: scope to followed vendors
    if (mode === 'followed') {
      if (!req.user) {
        return res.status(200).json({ success: true, count: 0, data: [] });
      }
      const followed = await Follow.find({ user_id: req.user._id || req.user.id }).select('vendor_id').lean();
      if (!followed.length) {
        return res.status(200).json({ success: true, count: 0, data: [] });
      }
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
      .select(STATUS_STORY_SELECT)
      .sort(sortOption)
      .skip((pageNumber - 1) * pageLimit)
      .limit(pageLimit)
      .populate(STATUS_VENDOR_POPULATE)
      .populate(STATUS_LINKED_PRODUCT_POPULATE)
      .lean();

    const userId = req.user?._id || req.user?.id;
    const formattedStatuses = statuses.map((status) => formatStatusPayload(status, userId));

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
      .select(STATUS_STORY_SELECT)
      .populate(STATUS_VENDOR_POPULATE)
      .populate(STATUS_LINKED_PRODUCT_POPULATE)
      .lean();

    if (!status) {
      return res.status(404).json({ success: false, message: 'Story not found or expired' });
    }

    const userId = req.user?._id || req.user?.id;
    res.status(200).json({ success: true, data: formatStatusPayload(status, userId) });
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
    const hasLiked = index === -1;
    
    if (hasLiked) {
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
    res.status(200).json({
      success: true,
      data: {
        liked: hasLiked,
        likes_count: status.likes_count,
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Mark status as viewed
// @route   POST /api/statuses/:id/view
// @access  Private
exports.viewStatus = async (req, res) => {
  try {
    let updatedStatus;
    if (req.user) {
      const userId = req.user._id || req.user.id;
      // Increment views_count ONLY if this user hasn't viewed it yet
      updatedStatus = await Status.findOneAndUpdate(
        { _id: req.params.id, viewer_ids: { $ne: userId } },
        { 
          $addToSet: { viewer_ids: userId }, 
          $inc: { views_count: 1 } 
        },
        { returnDocument: 'after' }
      );

      // If user already viewed it, findOneAndUpdate returns null.
      // Retrieve the existing status document without incrementing.
      if (!updatedStatus) {
        updatedStatus = await Status.findById(req.params.id);
      }
    } else {
      // For guests/anonymous views, increment unconditionally
      updatedStatus = await Status.findByIdAndUpdate(
        req.params.id,
        { $inc: { views_count: 1 } },
        { returnDocument: 'after' }
      );
    }

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
    const vendor = await Vendor.findOne({ user_id: req.user._id });
    if (!vendor) return res.status(403).json({ success: false, message: 'Vendor profile required' });

    const statuses = await Status.find({ vendor_id: vendor._id })
      .select('_id type content_url thumbnail_url text_content linked_product caption category expires_at views_count likes_count createdAt segment_start segment_end segment_index segment_count')
      .sort({ createdAt: -1 })
      .populate(STATUS_LINKED_PRODUCT_POPULATE)
      .lean();

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
    const vendor = await Vendor.findOne({ user_id: req.user._id });
    const status = await Status.findById(req.params.id);

    if (!status) return res.status(404).json({ success: false, message: 'Status not found' });
    if (status.vendor_id.toString() !== vendor?._id?.toString()) {
      return res.status(401).json({ success: false, message: 'Not authorized to delete this status' });
    }

    const [sameMediaCount, sameThumbnailCount] = await Promise.all([
      status.content_url
        ? Status.countDocuments({ _id: { $ne: status._id }, content_url: status.content_url })
        : Promise.resolve(0),
      status.thumbnail_url
        ? Status.countDocuments({ _id: { $ne: status._id }, thumbnail_url: status.thumbnail_url })
        : Promise.resolve(0),
    ]);

    await status.deleteOne();
    if (status.content_url && sameMediaCount === 0) {
      deleteS3ObjectByUrl(status.content_url, { allowedPrefix: ['statuses/', 'status-sources/'] }).catch((err) => {
        console.warn(`[Status] Temporary media cleanup failed for ${status._id}: ${err.message}`);
      });
    }
    if (status.thumbnail_url && sameThumbnailCount === 0) {
      deleteS3ObjectByUrl(status.thumbnail_url).catch((err) => {
        console.warn(`[Status] Temporary thumbnail cleanup failed for ${status._id}: ${err.message}`);
      });
    }
    res.status(200).json({ success: true, message: 'Status removed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
