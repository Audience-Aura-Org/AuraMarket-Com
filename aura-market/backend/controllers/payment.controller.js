const axios = require('axios');
const Transaction = require('../models/Transaction.model');
const User = require('../models/User.model');
const { PAYSTACK_SECRET_KEY } = require('../config/env');
const crypto = require('crypto');

/**
 * controllers/payment.controller.js
 * Handles Paystack payment integration for wallet deposits.
 */

// ─────────────────────────────────────────────
// @route   POST /api/payments/initialize
// @desc    Initialize a transaction with Paystack
// @access  Private
// ─────────────────────────────────────────────
const initializePayment = async (req, res, next) => {
  try {
    const { amount } = req.body; // Amount in local currency (e.g. XAF or NGN)
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount.' });
    }

    // Paystack expects amount in sub-units (kobo/cents) -> multiply by 100
    // Note: XAF doesn't use sub-units usually, but Paystack handles this depending on integration.
    // Assuming NGN/GHS/USD for standard Paystack sub-units logic.
    const paystackAmount = amount * 100;

    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email: req.user.email,
        amount: paystackAmount,
        callback_url: `${process.env.WEB_CLIENT_URL}/wallet/verify`,
        metadata: {
          user_id: req.user._id,
          type: 'deposit'
        }
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const { authorization_url, reference } = response.data.data;

    // Create a pending transaction record
    await Transaction.create({
      user_id: req.user._id,
      type: 'deposit',
      amount: amount,
      reference: reference, // Paystack's unique ref
      status: 'pending',
      description: 'Wallet deposit via Paystack'
    });

    res.status(200).json({
      success: true,
      data: { checkout_url: authorization_url, reference }
    });
  } catch (error) {
    console.error('Paystack Init Error:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Payment initialization failed.' });
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/payments/verify/:reference
// @desc    Verify payment status after customer returns
// @access  Private
// ─────────────────────────────────────────────
const verifyPayment = async (req, res, next) => {
  try {
    const { reference } = req.params;

    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`
        }
      }
    );

    const { status, amount, metadata } = response.data.data;

    if (status === 'success') {
      const transaction = await Transaction.findOne({ reference });

      if (transaction && transaction.status === 'pending') {
        // Update transaction status
        transaction.status = 'completed';
        transaction.gateway_response = response.data.data;
        await transaction.save();

        // Update user wallet balance
        // amount returned by Paystack is in sub-units, converting back
        const creditAmount = amount / 100;
        await User.findByIdAndUpdate(transaction.user_id, {
          $inc: { wallet_balance: creditAmount }
        });

        return res.status(200).json({
          success: true,
          message: 'Payment verified and wallet credited.',
          data: { balance_added: creditAmount }
        });
      } else if (transaction && transaction.status === 'completed') {
        return res.status(200).json({ success: true, message: 'Payment already processed.' });
      }
    }

    res.status(400).json({ success: false, message: 'Payment verification failed or incomplete.' });
  } catch (error) {
    console.error('Paystack Verify Error:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Internal verification error.' });
  }
};

// ─────────────────────────────────────────────
// @route   POST /api/payments/webhook
// @desc    Handle Paystack webhooks (background verification)
// @access  Public (Secret verification required)
// ─────────────────────────────────────────────
const handleWebhook = async (req, res, next) => {
  try {
    // Verify signature
    const hash = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY).update(JSON.stringify(req.body)).digest('hex');
    if (hash !== req.headers['x-paystack-signature']) {
      return res.status(400).send('Invalid signature');
    }

    const event = req.body;

    if (event.event === 'charge.success') {
      const { reference, amount, customer } = event.data;
      
      const transaction = await Transaction.findOne({ reference });
      if (transaction && transaction.status === 'pending') {
        transaction.status = 'completed';
        transaction.gateway_response = event.data;
        await transaction.save();

        await User.findByIdAndUpdate(transaction.user_id, {
          $inc: { wallet_balance: amount / 100 }
        });
      }
    }

    res.status(200).send('Webhook processed');
  } catch (error) {
    console.error('Webhook Error:', error);
    res.status(500).send('Internal Server Error');
  }
};

module.exports = {
  initializePayment,
  verifyPayment,
  handleWebhook
};
