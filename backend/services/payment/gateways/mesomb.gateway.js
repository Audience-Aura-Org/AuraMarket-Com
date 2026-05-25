/**
 * services/payment/gateways/mesomb.gateway.js
 * Auradime — MeSomb Mobile Money Gateway
 *
 * Supports MTN MoMo & Orange Money in Cameroon (XAF).
 * Direct collection — no checkout redirect URL needed.
 * Payment is confirmed when the user approves the USSD prompt on their phone.
 */

const mesomb = require('../../mesomb.service');
const Transaction = require('../../../models/Transaction.model');
const { settleOrders } = require('../settle.service');
const mongoose = require('mongoose');
const crypto = require('crypto');

const mesombGateway = {
  id: 'mesomb',
  label: 'MTN MoMo / Orange Money',
  description: 'Pay via MTN Mobile Money or Orange Money. A prompt will be sent to your phone.',
  icon: '📲',
  currencies: ['XAF'],
  regions: ['CM'],
  enabled: !!(process.env.MESOMB_APPLICATION_KEY && process.env.MESOMB_ACCESS_KEY && process.env.MESOMB_SECRET_KEY),
  fields: [
    {
      name: 'phone',
      label: 'Mobile Money Number',
      type: 'tel',
      placeholder: '677 XXX XXX or 690 XXX XXX',
      required: true,
      hint: 'Enter your MTN or Orange Money number',
    },
    {
      name: 'service',
      label: 'Network',
      type: 'select',
      required: false,
      options: [
        { value: '', label: 'Auto-detect from number' },
        { value: 'MTN', label: 'MTN Mobile Money' },
        { value: 'ORANGE', label: 'Orange Money' },
      ],
    },
  ],

  /**
   * Initialize a MeSomb collection.
   * The platform pushes a USSD prompt to the payer's phone directly.
   * No redirect URL needed — wait for webhook or poll for confirmation.
   *
   * @param {Object} ctx - { user, amount, currency, orderIds, fields: { phone, service }, req }
   */
  async initialize({ user, amount, currency = 'XAF', orderIds = [], fields = {}, req }) {
    const { phone, service } = fields;

    if (!phone) throw new Error('Phone number is required for mobile money payment.');
    if (amount < 50) throw new Error('Minimum amount for MeSomb is 50 XAF.');

    // Auto-detect operator if not specified
    const detectedService = service || mesomb.detectOperator(phone);
    if (!detectedService) {
      throw new Error(`Cannot detect mobile operator for "${phone}". Please specify MTN or Orange Money.`);
    }

    const reference = `AURA-MSB-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const trxID = reference;

    // Make the collect call — this sends USSD prompt to the user's phone
    let response;
    try {
      response = await mesomb.makeCollect({
        amount,
        phone,
        service: detectedService,
        currency,
        trxID,
        message: `Auradime — ${orderIds.length > 0 ? `Order Payment (${orderIds.length} item${orderIds.length > 1 ? 's' : ''})` : 'Wallet Top-up'}`,
      });
    } catch (err) {
      console.error('[mesomb.gateway] Collection error:', err.message);
      throw new Error(`Mobile money collection failed: ${err.message}`);
    }

    const status = mesomb.mapStatus(response);
    const mesombTxId = response?.transaction?.pk || response?.pk || response?.id || null;

    // Record the pending transaction in our DB
    await Transaction.create({
      user_id: user._id,
      type: 'deposit',
      amount,
      currency,
      reference,
      gateway_transaction_id: mesombTxId,
      status: status === 'SUCCESSFUL' ? 'completed' : 'pending',
      gateway: 'mesomb',
      order_ids: orderIds,
      description: orderIds.length > 0
        ? `Checkout for ${orderIds.length} order(s) via MeSomb (${detectedService})`
        : `Wallet top-up via MeSomb (${detectedService})`,
      gateway_response: response,
      metadata: { service: detectedService, phone: mesomb.normalizePhone(phone) },
    });

    // If MeSomb returned success immediately (some networks confirm sync),
    // settle orders straight away
    if (status === 'SUCCESSFUL' && orderIds.length > 0) {
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        await settleOrders(user._id, orderIds, session, req?.app, true, process.env.WEB_CLIENT_URL || '', 'mesomb');
        await session.commitTransaction();
      } catch (err) {
        await session.abortTransaction();
        console.error('[mesomb.gateway] Post-collection settlement error:', err.message);
      } finally {
        session.endSession();
      }
    }

    return {
      reference,
      transaction_id: mesombTxId,
      status,
      instructions: status === 'SUCCESSFUL'
        ? 'Payment confirmed! Your order is being processed.'
        : `A payment prompt has been sent to ${phone}. Please approve it on your phone to complete the purchase.`,
    };
  },

  /**
   * Verify a MeSomb transaction by our internal reference.
   * Checks DB first, then the live MeSomb status if needed.
   *
   * @param {string} reference - Our internal AURA-MSB-... reference
   * @returns {{ status: 'SUCCESSFUL'|'PENDING'|'FAILED', amount?: number, reason?: string }}
   */
  async verify(reference) {
    const tx = await Transaction.findOne({ reference, gateway: 'mesomb' });
    if (!tx) return { status: 'PENDING' };

    // If already completed in our DB, return success
    if (tx.status === 'completed') return { status: 'SUCCESSFUL', amount: tx.amount };

    // Even if it failed in our DB (due to timeout), we should check the live status 
    // because the user might have approved it after our 5-min internal timeout.
    
    // Check how old the transaction is — after 20 minutes, really mark failed if still pending
    const ageMinutes = (Date.now() - new Date(tx.createdAt).getTime()) / 60000;
    
    try {
      // Poll MeSomb using the gateway ID or our reference
      const response = await mesomb.getTransactionStatus(tx.gateway_transaction_id || reference);
      const status = mesomb.mapStatus(response);

      if (status === 'SUCCESSFUL') {
        // Don't update the DB here — let the controller or webhook handle it to ensure atomicity
        // and consistency with settlement logic. But return SUCCESSFUL so they can trigger it.
        return { status: 'SUCCESSFUL', amount: tx.amount, gateway_response: response };
      }

      if (status === 'FAILED') {
        return { status: 'FAILED', reason: response?.message || 'Transaction was declined.' };
      }

      // If it's still PENDING on MeSomb but too old for us
      if (ageMinutes > 20) {
        if (tx.status !== 'failed') {
          await Transaction.findByIdAndUpdate(tx._id, { status: 'failed' });
        }
        return { status: 'FAILED', reason: 'Payment prompt expired. Please try again.' };
      }

      return { status: 'PENDING' };
    } catch (err) {
      console.error('[mesomb.gateway] Status check error:', err.message);
      
      // Fallback to internal timeout if MeSomb API is unreachable
      if (ageMinutes > 20) {
        if (tx.status !== 'failed') await Transaction.findByIdAndUpdate(tx._id, { status: 'failed' });
        return { status: 'FAILED', reason: 'Verification timed out. Please try again.' };
      }
      return { status: 'PENDING' };
    }
  },
};

module.exports = mesombGateway;
