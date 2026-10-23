'use strict';
const Vendor = require('../models/Vendor.model');
const Escrow = require('../models/Escrow.model');
const Withdrawal = require('../models/WithdrawalRequest.model');
module.exports = async function assertAccountDeletionAllowed(userIds) {
  const vendors = await Vendor.find({user_id:{$in:userIds}}).select('_id').lean();
  const [escrow,withdrawal] = await Promise.all([
    Escrow.exists({$or:[{buyer_id:{$in:userIds}},{vendor_id:{$in:vendors.map(vendor=>vendor._id)}}]}),
    Withdrawal.exists({requested_by:{$in:userIds},status:{$in:['pending','approved','processing_error']}}),
  ]);
  if(escrow || withdrawal)throw Object.assign(new Error('This account has escrow records or unsettled withdrawals. Settle its funds and deactivate it instead of deleting financial references.'),{statusCode:409});
};
