/**
 * services/payment/gateways/eversend.gateway.js
 * Aura Market — Eversend Mobile Money Gateway
 *
 * Wraps the existing eversend.service to conform to the GatewayInterface.
 * Supports XAF (MTN/Orange), NGN, UGX, KES, GHS, etc.
 */

const eversend = require('../../eversend.service');
const Transaction = require('../../../models/Transaction.model');
const User = require('../../../models/User.model');
const crypto = require('crypto');

const eversendGateway = {
  id: 'eversend',
  label: 'Mobile Money',
  description: 'Pay via MTN MoMo, Orange Money, or other mobile money networks.',
  icon: '📱',
  currencies: ['XAF', 'NGN', 'UGX', 'KES', 'GHS', 'RWF', 'TZS', 'ZMW'],
  regions: ['CM', 'NG', 'UG', 'KE', 'GH', 'RW', 'TZ', 'ZM', 'CI', 'SN'],
  enabled: true,
  fields: [
    {
      name: 'phone',
      label: 'Mobile Money Number',
      type: 'tel',
      placeholder: '+237 6XX XXX XXX',
      required: true,
    },
    {
      name: 'country',
      label: 'Country',
      type: 'select',
      required: true,
      options: [
        { value: 'CM', label: 'Cameroon (XAF)' },
        { value: 'NG', label: 'Nigeria (NGN)' },
        { value: 'UG', label: 'Uganda (UGX)' },
        { value: 'KE', label: 'Kenya (KES)' },
        { value: 'GH', label: 'Ghana (GHS)' },
        { value: 'RW', label: 'Rwanda (RWF)' },
      ],
    },
  ],

  /**
   * Sanitize a phone number to E.164 format.
   */
  _sanitizePhone(phone, country = 'CM') {
    if (!phone) return phone;
    let cleaned = phone.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('00')) cleaned = '+' + cleaned.slice(2);
    if (!cleaned.startsWith('+')) {
      const prefixes = { CM: '237', NG: '234', UG: '256', KE: '254', GH: '233', RW: '250', CI: '225', SN: '221', TZ: '255', ZM: '260' };
      const prefix = prefixes[country] || '237';
      if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);
      cleaned = `+${prefix}${cleaned}`;
    }
    return cleaned;
  },

  /**
   * Initialize an Eversend collection.
   * @param {Object} ctx - { user, amount, currency, orderIds, fields: { phone, country }, req }
   */
  async initialize({ user, amount, currency = 'XAF', orderIds = [], fields = {}, req }) {
    let { phone, country = 'CM' } = fields;
    phone = this._sanitizePhone(phone, country);

    if (!phone) throw new Error('Phone number is required for mobile money payment.');
    if (!currency) throw new Error('Currency is required.');

    const transactionRef = `AURA-EV-${Date.now()}-${user._id}`;
    const webUrl = req ? `${process.env.WEB_CLIENT_URL}` : '';
    const redirectUrl = `${webUrl}/wallet/verify?gateway=eversend&ref=${transactionRef}`;

    // Sandbox mode
    const isSandbox = process.env.EVERSEND_SANDBOX_MODE === 'true';
    if (isSandbox) {
      const sandboxTxId = `SBX-${Date.now()}`;
      await Transaction.create({
        user_id: user._id,
        type: 'deposit',
        amount: Number(amount),
        currency,
        reference: transactionRef,
        gateway_transaction_id: sandboxTxId,
        status: 'pending',
        gateway: 'eversend',
        order_ids: orderIds,
        description: `[SANDBOX] Checkout for ${orderIds.length} order(s)`,
        metadata: { is_sandbox: true },
      });
      return {
        checkout_url: `${webUrl}/wallet/verify?gateway=eversend&ref=${transactionRef}&sandbox=true`,
        reference: transactionRef,
        transaction_id: sandboxTxId,
      };
    }

    const nameParts = (user.name || '').split(' ');
    const firstName = nameParts[0] || 'Aura';
    const lastName = nameParts.slice(1).join(' ') || 'User';

    const collectionOpts = {
      amount, currency, phone, country, firstName, lastName,
      email: user.email, redirectUrl, transactionRef,
    };

    let result;
    if (currency === 'NGN') {
      result = await eversend.initiateNGNCollection(collectionOpts);
    } else {
      result = await eversend.initiateCollection(collectionOpts);
    }

    if (!result?.success) {
      throw new Error(result?.message || 'Eversend collection initiation failed.');
    }

    const responseData = result?.data || result;
    const gatewayTxId = responseData?.transactionId || responseData?.transaction_id || responseData?.id || null;
    const checkoutUrl = responseData?.checkoutUrl || responseData?.checkout_url || responseData?.paymentUrl || null;

    await Transaction.create({
      user_id: user._id,
      type: 'deposit',
      amount,
      currency,
      reference: transactionRef,
      gateway_transaction_id: gatewayTxId,
      status: 'pending',
      gateway: 'eversend',
      order_ids: orderIds,
      description: orderIds.length > 0
        ? `Checkout for ${orderIds.length} order(s) via Eversend (${currency})`
        : `Wallet top-up via Eversend (${currency})`,
    });

    return { checkout_url: checkoutUrl, reference: transactionRef, transaction_id: gatewayTxId };
  },

  /**
   * Verify an Eversend transaction by reference.
   * @param {string} reference
   * @returns {Object} { status, amount, reason }
   */
  async verify(reference) {
    const transaction = await Transaction.findOne({ reference, gateway: 'eversend' });
    if (!transaction) return { status: 'PENDING' };
    if (transaction.status === 'completed') return { status: 'SUCCESSFUL', amount: transaction.amount };
    if (transaction.status === 'failed') return { status: 'FAILED', reason: transaction.gateway_response?.message };

    if (!transaction.gateway_transaction_id) {
      const age = (Date.now() - new Date(transaction.createdAt).getTime()) / 1000;
      if (age > 60) return { status: 'FAILED', reason: 'Verification timed out.' };
      return { status: 'PENDING' };
    }

    const isSandbox = transaction.metadata?.is_sandbox ||
      transaction.gateway_transaction_id?.startsWith('SBX-');

    let txStatus;
    if (isSandbox) {
      txStatus = 'SUCCESSFUL';
    } else {
      const result = await eversend.getTransactionStatus(transaction.gateway_transaction_id);
      txStatus = result?.data?.status || result?.status;
    }

    if (txStatus === 'SUCCESSFUL') return { status: 'SUCCESSFUL', amount: transaction.amount };
    if (txStatus === 'FAILED') return { status: 'FAILED', reason: 'Payment declined by gateway.' };
    return { status: 'PENDING' };
  },
};

module.exports = eversendGateway;
