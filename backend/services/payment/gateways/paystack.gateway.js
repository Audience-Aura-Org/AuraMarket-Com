/**
 * services/payment/gateways/paystack.gateway.js
 * Auradime — Paystack Card/Bank Gateway
 *
 * Card payments via Paystack redirect. Used for wallet top-ups.
 * Conforms to the GatewayInterface.
 */

const axios = require('axios');
const Transaction = require('../../../models/Transaction.model');
const { PAYSTACK_SECRET_KEY } = require('../../../config/env');

const paystackGateway = {
  id: 'paystack',
  label: 'Card / Bank Transfer',
  description: 'Pay securely with your debit/credit card or bank transfer via Paystack.',
  icon: '💳',
  currencies: ['NGN', 'GHS', 'ZAR', 'USD', 'KES'],
  regions: ['NG', 'GH', 'ZA', 'KE'],
  enabled: !!PAYSTACK_SECRET_KEY,
  fields: [
    // Paystack handles all field collection on their hosted checkout page
    // No additional fields required from our frontend
  ],

  /**
   * Initialize a Paystack transaction.
   * @param {Object} ctx - { user, amount, currency, orderIds, req }
   */
  async initialize({ user, amount, currency = 'NGN', orderIds = [], req }) {
    const paystackAmount = amount * 100; // Paystack uses kobo/pesewas
    const webUrl = process.env.WEB_CLIENT_URL || '';
    const callbackUrl = `${webUrl}/wallet/verify?gateway=paystack`;

    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email: user.email,
        amount: paystackAmount,
        currency,
        callback_url: callbackUrl,
        metadata: { user_id: user._id, type: orderIds.length > 0 ? 'checkout' : 'deposit', order_ids: orderIds },
      },
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' } }
    );

    const { authorization_url, reference } = response.data.data;

    await Transaction.create({
      user_id: user._id,
      type: 'deposit',
      amount,
      reference,
      status: 'pending',
      gateway: 'paystack',
      currency,
      order_ids: orderIds,
      description: orderIds.length > 0
        ? `Checkout for ${orderIds.length} order(s) via Paystack`
        : `Wallet top-up via Paystack`,
    });

    return { checkout_url: authorization_url, reference };
  },

  /**
   * Verify a Paystack transaction by reference.
   * @param {string} reference
   */
  async verify(reference) {
    try {
      const response = await axios.get(
        `https://api.paystack.co/transaction/verify/${reference}`,
        { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } }
      );
      const { status, amount } = response.data.data;
      if (status === 'success') {
        return { status: 'SUCCESSFUL', amount: amount / 100 };
      }
      return { status: 'FAILED', reason: `Paystack status: ${status}` };
    } catch (err) {
      return { status: 'FAILED', reason: err.response?.data?.message || err.message };
    }
  },
};

module.exports = paystackGateway;
