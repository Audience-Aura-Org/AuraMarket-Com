/**
 * Migration 07 — Rename WithdrawalRequest fields from camelCase to snake_case
 *
 * Runs two $rename passes:
 *   Pass 1 — sub-document fields inside recipientDetails (must come first)
 *   Pass 2 — top-level document fields (includes recipientDetails → recipient_details)
 *
 * Idempotent: $rename silently no-ops if the source field doesn't exist.
 *
 * Run: node backend/migrations/07_withdrawal_snake_case.js
 */

(async () => {
  require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
  const mongoose = require('mongoose');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[07] Connected to MongoDB');

  const col = mongoose.connection.collection('withdrawalrequests');
  const before = await col.countDocuments();
  console.log(`[07] Documents in collection: ${before}`);

  // Pass 1: rename fields inside the recipientDetails sub-document
  // (must happen before the parent field is renamed)
  const pass1 = await col.updateMany({}, {
    $rename: {
      'recipientDetails.phoneNumber':   'recipientDetails.phone_number',
      'recipientDetails.bankCode':      'recipientDetails.bank_code',
      'recipientDetails.accountNumber': 'recipientDetails.account_number',
      'recipientDetails.eversendTag':   'recipientDetails.eversend_tag',
      'recipientDetails.beneficiaryId': 'recipientDetails.beneficiary_id',
      'recipientDetails.firstName':     'recipientDetails.first_name',
      'recipientDetails.lastName':      'recipientDetails.last_name',
    },
  });
  console.log(`[07] Pass 1 (sub-document fields): matched=${pass1.matchedCount} modified=${pass1.modifiedCount}`);

  // Pass 2: rename top-level fields
  const pass2 = await col.updateMany({}, {
    $rename: {
      requestedBy:            'requested_by',
      withdrawalMethod:       'withdrawal_method',
      recipientDetails:       'recipient_details',
      payoutGateway:          'payout_gateway',
      eversendTransactionId:  'eversend_transaction_id',
      eversendQuotationToken: 'eversend_quotation_token',
      eversendStatus:         'eversend_status',
      balanceDeducted:        'balance_deducted',
      rejectionReason:        'rejection_reason',
      failureReason:          'failure_reason',
      reviewedBy:             'reviewed_by',
      reviewedAt:             'reviewed_at',
    },
  });
  console.log(`[07] Pass 2 (top-level fields):   matched=${pass2.matchedCount} modified=${pass2.modifiedCount}`);

  // Verify: sample a document and confirm snake_case
  const sample = await col.findOne({});
  if (sample) {
    const hasOld = Object.keys(sample).some(k =>
      ['requestedBy','withdrawalMethod','recipientDetails','payoutGateway',
       'eversendTransactionId','eversendStatus','balanceDeducted',
       'rejectionReason','failureReason','reviewedBy','reviewedAt'].includes(k)
    );
    if (hasOld) {
      console.error('[07] WARN: sample document still has camelCase fields — check manually');
    } else {
      console.log('[07] Verification: sample document has no legacy camelCase top-level fields ✓');
    }
  }

  await mongoose.disconnect();
  console.log('[07] Done\n');
})().catch(err => { console.error(err); process.exit(1); });
