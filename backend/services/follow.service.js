const mongoose = require('mongoose');
const Vendor = require('../models/Vendor.model');
const Follow = require('../models/Follow.model');
async function changeFollow(userId, vendorId, following) {
  if (!mongoose.isValidObjectId(vendorId)) throw Object.assign(new Error('Invalid vendor ID.'), { statusCode: 400 });
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const vendor = await Vendor.findById(vendorId).session(session);
      if (!vendor) throw Object.assign(new Error('Vendor not found.'), { statusCode: 404 });
      if (following && String(vendor.user_id) === String(userId)) throw Object.assign(new Error('You cannot follow your own store.'), { statusCode: 400 });
      const exists = await Follow.findOne({ user_id: userId, vendor_id: vendorId }).session(session);
      if (Boolean(exists) === following) {
        result = { status: 400, success: false, message: following ? 'Already following this vendor.' : 'You are not following this vendor.', follower_count: vendor.follower_count || 0 }; return;
      }
      // The vendor write serializes independent followers as well as repeated taps.
      const count = Math.max(0, Number(vendor.follower_count || 0) + (following ? 1 : -1));
      await Vendor.updateOne({ _id: vendorId }, { $set: { follower_count: count } }, { session });
      if (following) await Follow.create([{ user_id: userId, vendor_id: vendorId }], { session });
      else await Follow.deleteOne({ _id: exists._id }, { session });
      result = { status: following ? 201 : 200, success: true, message: following ? 'Now following ' + vendor.store_name + '.' : 'Unfollowed successfully.', follower_count: count };
    });
    return result;
  } finally { await session.endSession(); }
}
module.exports = { changeFollow };
