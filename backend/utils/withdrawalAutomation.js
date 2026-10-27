'use strict';
const pawapay = require('../services/payment/gateways/pawapay.gateway');
const supportedMtnPhone = value => {
  if (typeof value !== 'string') return false;
  const phone = pawapay.normalizePhone(value);
  return /^237(?:65[0-4]\d{6}|6[78]\d{7})$/.test(phone);
};
// MTN always; Orange (655-659, 69x) only once PAWAPAY_ORANGE_ENABLED is on.
const supportedPawaPayoutPhone = value => supportedMtnPhone(value) || (
  pawapay.isOrangeEnabled() && typeof value === 'string' && /^237(?:65[5-9]\d{6}|69\d{7})$/.test(pawapay.normalizePhone(value))
);
const isAutoEligible = (request, policy) => Boolean(
  policy?.enabled && policy.epoch && policy.activated_at &&
  request.auto_approval_epoch === policy.epoch &&
  new Date(request.createdAt) > new Date(policy.activated_at) &&
  request.status === 'pending' && request.balance_deducted &&
  request.withdrawal_method === 'momo' && String(request.currency).toUpperCase() === 'XAF' &&
  String(request.recipient_details?.country || '').toUpperCase() === 'CM' &&
  supportedPawaPayoutPhone(request.recipient_details?.phone_number)
);
module.exports = { supportedMtnPhone, supportedPawaPayoutPhone, isAutoEligible };
