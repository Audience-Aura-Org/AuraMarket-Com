/**
 * services/withdrawalRecord.service.js
 * The money part of a withdrawal request, shared by POST /withdrawals and the
 * guest refund sweep: debit the wallet, create the request and its pending
 * ledger transaction, all inside the caller's session.
 */
const crypto = require('crypto');
const WithdrawalRequest = require('../models/WithdrawalRequest.model');
const Transaction = require('../models/Transaction.model');
const { debitBalance } = require('./wallet.service');

const generateTxRef = () => `AURA-WD-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

/**
 * @returns {{ withdrawalRequest, debitResult }}
 * @throws 400 'Insufficient wallet balance.' when the atomic debit fails
 */
const createWithdrawalRecord = async ({ userId, role, amount, currency, withdrawal_method, recipient_details, note, platformSettings }, session) => {
  const { first_name, last_name, country } = recipient_details;
  const debitResult = await debitBalance(userId, amount, session);
  if (!debitResult) throw Object.assign(new Error('Insufficient wallet balance.'), { statusCode: 400 });

  const [withdrawalRequest] = await WithdrawalRequest.create([{
    requested_by: userId,
    role,
    amount,
    currency,
    withdrawal_method,
    payout_gateway: null,
    recipient_details: {
      phone_number:   recipient_details.phone_number   || null,
      eversend_tag:   recipient_details.eversend_tag   || null,
      beneficiary_id: recipient_details.beneficiary_id || null,
      first_name,
      last_name,
      country,
    },
    note: note || null,
    status: 'pending',
    balance_deducted: true,
    auto_approval_epoch: platformSettings.withdrawal_automation?.enabled && currency === 'XAF' && country === 'CM' && require('../utils/withdrawalAutomation').supportedPawaPayoutPhone(recipient_details.phone_number) ? platformSettings.withdrawal_automation.epoch : null,
  }], { session, ordered: true });

  await Transaction.create([{
    user_id: userId,
    type: 'withdrawal',
    amount: amount,
    reference: generateTxRef(),
    status: 'pending',
    description: `Withdrawal via ${withdrawal_method.toUpperCase()} to ${recipient_details.phone_number || recipient_details.account_number || recipient_details.eversend_tag || recipient_details.beneficiary_id}`,
    gateway: 'manual',
    currency: currency,
    metadata: { withdrawal_request_id: withdrawalRequest._id },
  }], { session, ordered: true });

  return { withdrawalRequest, debitResult };
};

module.exports = { createWithdrawalRecord };
