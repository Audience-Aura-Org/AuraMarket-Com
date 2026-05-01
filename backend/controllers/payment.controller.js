const axios = require('axios');
const crypto = require('crypto');
const Transaction = require('../models/Transaction.model');
const User = require('../models/User.model');
const Order = require('../models/Order.model');
const Escrow = require('../models/Escrow.model');
const LogisticsCompany = require('../models/LogisticsCompany.model');
const logisticsService = require('../services/logistics.service');
const { PAYSTACK_SECRET_KEY } = require('../config/env');
const eversend = require('../services/eversend.service');
const { sendNotification } = require('../utils/notifier');
const mongoose = require('mongoose');
const Vendor = require('../models/Vendor.model');
const Shipment = require('../models/Shipment.model');

/**
 * controllers/payment.controller.js
 * Handles Paystack (legacy) + Eversend payment integrations for wallet deposits.
 */

// ─────────────────────────────────────────────────────────────────────────────
// PAYSTACK — kept intact for existing wallet flows
// ─────────────────────────────────────────────────────────────────────────────

const initializePayment = async (req, res, next) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount.' });
    }

    const paystackAmount = amount * 100;

    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email: req.user.email,
        amount: paystackAmount,
        callback_url: `${process.env.WEB_CLIENT_URL}/wallet/verify`,
        metadata: { user_id: req.user._id, type: 'deposit' }
      },
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' } }
    );

    const { authorization_url, reference } = response.data.data;

    await Transaction.create({
      user_id: req.user._id,
      type: 'deposit',
      amount,
      reference,
      status: 'pending',
      gateway: 'paystack',
      description: 'Wallet deposit via Paystack'
    });

    res.status(200).json({ success: true, data: { checkout_url: authorization_url, reference } });
  } catch (error) {
    console.error('Paystack Init Error:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Payment initialization failed.' });
  }
};

const verifyPayment = async (req, res, next) => {
  try {
    const { reference } = req.params;

    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } }
    );

    const { status, amount } = response.data.data;

    if (status === 'success') {
      const transaction = await Transaction.findOne({ reference });

      if (transaction && transaction.status === 'pending') {
        transaction.status = 'completed';
        transaction.gateway_response = response.data.data;
        await transaction.save();

        const creditAmount = amount / 100;
        await User.findByIdAndUpdate(transaction.user_id, { $inc: { wallet_balance: creditAmount } });

        return res.status(200).json({
          success: true,
          message: 'Payment verified and wallet credited.',
          data: { balance_added: creditAmount }
        });
      } else if (transaction?.status === 'completed') {
        return res.status(200).json({ success: true, message: 'Payment already processed.' });
      }
    }

    res.status(400).json({ success: false, message: 'Payment verification failed or incomplete.' });
  } catch (error) {
    console.error('Paystack Verify Error:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Internal verification error.' });
  }
};

const handleWebhook = async (req, res, next) => {
  try {
    const hash = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY).update(JSON.stringify(req.body)).digest('hex');
    if (hash !== req.headers['x-paystack-signature']) {
      return res.status(400).send('Invalid signature');
    }

    const event = req.body;

    if (event.event === 'charge.success') {
      const { reference, amount } = event.data;
      const transaction = await Transaction.findOne({ reference });
      if (transaction && transaction.status === 'pending') {
        transaction.status = 'completed';
        transaction.gateway_response = event.data;
        await transaction.save();
        await User.findByIdAndUpdate(transaction.user_id, { $inc: { wallet_balance: amount / 100 } });
      }
    }

    res.status(200).send('Webhook processed');
  } catch (error) {
    console.error('Paystack Webhook Error:', error);
    res.status(500).send('Internal Server Error');
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// EVERSEND — new payment gateway
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Utility: Sanitize phone number to E.164 format for Eversend
 */
const sanitizePhone = (phone, country = 'CM') => {
  if (!phone) return phone;
  // Remove all non-numeric characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // If it starts with 00, replace with +
  if (cleaned.startsWith('00')) cleaned = '+' + cleaned.slice(2);
  
  // Cameroon (CM) normalization
  if (country === 'CM') {
    if (cleaned.startsWith('237')) return '+' + cleaned;
    if (cleaned.startsWith('6')) return '+237' + cleaned;
  }
  
  // Default fallback for CM if no country provided
  if (cleaned.length === 9 && (cleaned.startsWith('6') || cleaned.startsWith('2'))) {
    return '+237' + cleaned;
  }

  // Ensure it starts with + if it has a country code but no prefix
  if (cleaned.length > 5 && !cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }

  return cleaned;
};

/**
 * @route   POST /api/payments/eversend/otp
 * @desc    Request an OTP for an unverified collection flow (sandbox testing)
 * @access  Private
 * @body    { phone, country }
 */
const eversendRequestOTP = async (req, res) => {
  try {
    let { phone, country } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: 'Phone number is required.' });

    // Sanitize to E.164 — same logic as eversendInitialize so Eversend accepts the number
    phone = sanitizePhone(phone, country || 'CM');
    console.log('[Eversend OTP] Requesting OTP for sanitized phone:', phone);

    const result = await eversend.requestOTP(phone);
    // Eversend returns { code, data: { pinId }, success }
    return res.status(200).json({ success: true, data: result.data });
  } catch (error) {
    const errorData = error.response?.data || { message: error.message };
    console.error('Eversend OTP Handshake Error:', errorData);
    res.status(error.response?.status || 500).json({ 
      success: false, 
      message: 'Failed to dispatch OTP.', 
      detail: errorData 
    });
  }
};

/**
 * @route   POST /api/payments/eversend/initialize
 * @desc    Initiate an Eversend collection (mobile money / card)
 * @access  Private
 * @body    { amount, currency, phone, country }
 */
const eversendInitialize = async (req, res) => {
  try {
    let { amount, currency, phone, country, order_ids, redirect_url: customRedirect, otp } = req.body;

    // 1. Sanitize phone number early
    phone = sanitizePhone(phone, country);

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount.' });
    }
    if (!currency || !phone || !country) {
      return res.status(400).json({ success: false, message: 'currency, phone, and country are required.' });
    }

    const user = req.user;
    const transactionRef = `AURA-${Date.now()}-${user._id}`;
    const redirectUrl = customRedirect || `${process.env.WEB_CLIENT_URL}/wallet/verify?gateway=eversend&ref=${transactionRef}`;

    // ── SANDBOX SIMULATION MODE ───────────────────────────────────────────────
    // Set EVERSEND_SANDBOX_MODE=true in .env to bypass the live gateway and test
    // the full checkout → order settlement flow locally.
    if (process.env.EVERSEND_SANDBOX_MODE === 'true') {
      console.log('[Eversend] SANDBOX MODE — simulating successful collection');
      const sandboxTxId = `SBX-${Date.now()}`;
      
      const session = await mongoose.startSession();
      session.startTransaction();
      
      try {
        // 1. Create the deposit transaction
        await Transaction.create([{
          user_id: user._id,
          type: 'deposit',
          amount: Number(amount),
          currency,
          reference: transactionRef,
          gateway_transaction_id: sandboxTxId,
          status: 'completed',
          gateway: 'eversend',
          order_ids: order_ids || [],
          description: `[SANDBOX] Checkout simulation for ${order_ids?.length || 0} order(s)`,
        }], { session });

        // 2. Credit the wallet
        await User.findByIdAndUpdate(user._id, {
           $inc: { wallet_balance: Number(amount) }
        }, { session });

        // 3. Auto-settle orders immediately in sandbox (skipping liquidity check just in case)
        if (order_ids && order_ids.length > 0) {
          await settleOrdersInSession(user._id, order_ids, req.app, session, true);
        }

        await session.commitTransaction();
        session.endSession();

        return res.status(200).json({
          success: true,
          data: { checkout_url: null, transaction_id: sandboxTxId, reference: transactionRef },
        });
      } catch (err) {
        console.error('[Eversend Sandbox Error]:', err.message, err.stack);
        await session.abortTransaction();
        session.endSession();
        return res.status(500).json({
           success: false,
           message: `Sandbox simulation failed: ${err.message}`,
           error: err.stack
        });
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    const nameParts = (user.name || '').split(' ');
    const firstName = nameParts[0] || 'Aura';
    const lastName = nameParts.slice(1).join(' ') || 'User';

    console.log('[Eversend] Initiating live collection:', { amount, currency, phone, country });
    const result = await eversend.initiateCollection({
      amount,
      currency,
      phone,
      country,
      firstName,
      lastName,
      email: user.email,
      redirectUrl,
      transactionRef,
      otp,
    });

    // Eversend may return errors in different shapes — normalise
    if (!result || !result.success) {
      console.error('Eversend Collection Failed:', JSON.stringify(result));
      return res.status(400).json({ 
        success: false, 
        message: result?.message || 'Eversend initiation protocol failed.',
        detail: result 
      });
    }

    // Extract IDs — Eversend uses different field names across API versions
    const responseData = result?.data || result;
    const gatewayTxId =
      responseData?.transactionId ||
      responseData?.transaction_id ||
      responseData?.id ||
      null;
    const checkoutUrl =
      responseData?.checkoutUrl ||
      responseData?.checkout_url ||
      responseData?.paymentUrl ||
      responseData?.payment_url ||
      null;

    console.log(`[Eversend] gatewayTxId=${gatewayTxId} checkoutUrl=${checkoutUrl}`);

    // Persist pending transaction with optional order relations
    await Transaction.create({
      user_id: user._id,
      type: 'deposit',
      amount,
      currency,
      reference: transactionRef,
      gateway_transaction_id: gatewayTxId,
      status: 'pending',
      gateway: 'eversend',
      order_ids: order_ids || [],
      description: order_ids?.length > 0
        ? `Checkout payment for ${order_ids.length} nodes via Eversend (${currency})`
        : `Wallet deposit via Eversend (${currency})`,
    });

    return res.status(200).json({
      success: true,
      data: {
        checkout_url: checkoutUrl,
        transaction_id: gatewayTxId,
        reference: transactionRef,
      },
    });
  } catch (error) {
    const evError = error.response?.data;
    const statusCode = error.response?.status || 500;
    console.error('Eversend Init Error:', statusCode, evError || error.message);

    let userMessage = 'Eversend payment initialization failed.';
    if (statusCode === 401) {
      userMessage = 'Eversend Collections not authorized for this account. Enable Collections in your Eversend dashboard under API Settings.';
    } else if (evError?.message && typeof evError.message === 'string') {
      userMessage = evError.message;
    }

    res.status(statusCode < 500 ? statusCode : 500).json({
      success: false,
      message: userMessage,
      detail: evError
    });
  }
};

/**
 * Internal Helper: Settle orders using the user's wallet balance
 * (Used after a successful top-up via gateway)
 */
const settleOrdersInSession = async (userId, orderIds, app, externalSession = null, skipBalanceCheck = false) => {
  const session = externalSession || await mongoose.startSession();
  if (!externalSession) session.startTransaction();

  try {
    const user = await User.findById(userId).session(session);
    if (!user) throw new Error('User not found.');

    for (const orderId of orderIds) {
      const order = await Order.findById(orderId).session(session);
      if (!order || order.payment_status !== 'pending') continue;

      if (!skipBalanceCheck && user.wallet_balance < order.total_amount) {
        throw new Error(`Insufficient liquidity for order #${orderId.toString().slice(-4)}`);
      }

      // 1. Deduct balance (if skipping check, we assume it's prepaid/sandbox)
      if (!skipBalanceCheck || user.wallet_balance >= order.total_amount) {
        user.wallet_balance -= order.total_amount;
      }
      
      // 2. Mark order paid
      order.payment_status = 'paid';
      order.order_status = 'processing';
      await order.save({ session });

      // 3. Create individual payment transaction record
      await Transaction.create([{
        user_id: user._id,
        type: 'payment',
        amount: order.total_amount,
        reference: `SETTLE-${Date.now()}-${order._id.toString().slice(-4)}`,
        status: 'completed',
        description: `Automatic settlement for Order #${order._id.toString().slice(-6).toUpperCase()}`,
        order_id: order._id,
        gateway: 'wallet'
      }], { session });

      // 4. Logistics & Notifications
      if (order.shipping_method === 'logistics_partner' && order.logistics_company_id) {
         const quartier = order.shipping_address?.quartier;
         if (quartier) {
            // Check if shipment already exists to avoid E11000 duplicate key errors
            const existingShipment = await Shipment.findOne({ order_id: order._id }).session(session);
            if (!existingShipment) {
               await logisticsService.createShipmentsForOrder(order, quartier, order.logistics_company_id, session);
            }
         }
      }

      const vendor = await Vendor.findById(order.vendor_id).session(session);
      const orderForNotify = order.toObject();
      orderForNotify.vendor_id = vendor;

      // ── Dispatch notifications in background (Post-Commit handled by app logic or setImmediate)
      setImmediate(async () => {
         try {
           // A. Notify Vendor
           if (vendor) {
              await sendNotification(app, vendor.user_id, {
                title: 'Order Paid & Confirmed',
                message: `Payment received for order #${order._id.toString().slice(-6).toUpperCase()} from ${user.name}.`,
                type: 'order_status',
                metadata: { order_id: order._id, link: '/vendor/orders' },
                sendEmail: true,
                orderDetails: orderForNotify,
                role: 'vendor'
              });
           }

           // B. Notify Customer
           await sendNotification(app, user._id, {
             title: 'Order Payment Confirmed',
             message: `Your payment for order #${order._id.toString().slice(-6).toUpperCase()} has been verified.`,
             type: 'order_status',
             metadata: { order_id: order._id, link: '/orders' },
             sendEmail: true,
             orderDetails: orderForNotify,
             role: 'customer'
           });

           // C. Notify Logistics Partner if applicable
           if (order.shipping_method === 'logistics_partner' && order.logistics_company_id) {
             const quartier = order.shipping_address?.quartier;
             if (quartier) {
               const logisticsFirm = await LogisticsCompany.findById(order.logistics_company_id);
               if (logisticsFirm) {
                 await sendNotification(app, logisticsFirm.user_id, {
                   title: 'New Shipment Assigned',
                   message: `Order #${order._id.toString().slice(-6).toUpperCase()} is ready for pickup.`,
                   type: 'system_alert',
                   metadata: { order_id: order._id, link: '/logistics/dashboard' },
                   sendEmail: true,
                   role: 'logistics'
                 });
               }
             }
           }
         } catch (bgError) {
           console.error('Settlement bg notification error:', bgError);
         }
      });
    }

    await user.save({ session });
    if (!externalSession) {
       await session.commitTransaction();
    }
    console.log(`✅ Aura settlement: orders ${orderIds.join(', ')} finalized for user ${userId}`);
  } catch (error) {
    if (!externalSession) {
       await session.abortTransaction();
    }
    console.error('Settlement Error:', error.message);
    throw error;
  } finally {
    if (!externalSession) {
      session.endSession();
    }
  }
};

/**
 * @route   GET /api/payments/eversend/verify/:reference
 * @desc    Poll Eversend for transaction status and credit wallet if successful
 * @access  Private
 */
const eversendVerify = async (req, res) => {
  try {
    const { reference } = req.params;

    const transaction = await Transaction.findOne({ reference, gateway: 'eversend' });
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found.' });
    }

    if (transaction.status === 'completed') {
      // Already settled (sandbox mode or previously verified)
      return res.status(200).json({
        success: true,
        message: 'Payment already processed and orders settled.',
        // No status field = frontend treats as success immediately
      });
    }

    // If no gateway transaction ID yet, the Eversend charge is queued (STK push sent but not confirmed)
    if (!transaction.gateway_transaction_id) {
      console.warn(`[Eversend Verify] No gateway_transaction_id for ref=${reference}. Holding as PENDING.`);
      return res.status(200).json({ success: true, message: 'Awaiting mobile money confirmation from gateway.', status: 'PENDING' });
    }

    // Poll Eversend for status
    const result = await eversend.getCollectionStatus(transaction.gateway_transaction_id);
    console.log(`[Eversend Verify] ref=${reference} txId=${transaction.gateway_transaction_id} status=`, result?.data?.status);
    const txStatus = result?.data?.status || result?.status; // 'PENDING' | 'SUCCESSFUL' | 'FAILED'

    if (txStatus === 'SUCCESSFUL') {
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        transaction.status = 'completed';
        transaction.gateway_response = result.data;
        await transaction.save({ session });

        // Credit wallet using the same session
        await User.findByIdAndUpdate(transaction.user_id, {
          $inc: { wallet_balance: transaction.amount },
        }, { session });

        // 🔥 AUTO-SETTLE ORDERS IF ATTACHED
        if (transaction.order_ids && transaction.order_ids.length > 0) {
          await settleOrdersInSession(transaction.user_id, transaction.order_ids, req.app, session);
        }

        await session.commitTransaction();
      } catch (err) {
        await session.abortTransaction();
        throw err;
      } finally {
        session.endSession();
      }

      return res.status(200).json({
        success: true,
        message: 'Payment verified and wallet credited.',
        data: { balance_added: transaction.amount },
      });
    }

    if (txStatus === 'FAILED') {
      transaction.status = 'failed';
      await transaction.save();
      return res.status(400).json({ success: false, message: 'Eversend payment failed.' });
    }

    // Still pending
    return res.status(200).json({ success: true, message: 'Payment still processing.', status: txStatus });
  } catch (error) {
    console.error('Eversend Verify Error:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Eversend verification error.' });
  }
};

/**
 * @route   POST /api/payments/eversend/webhook
 * @desc    Handle Eversend webhook events (transaction.success / transaction.failed)
 * @access  Public (signature verified)
 */
const eversendWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-eversend-signature'];
    const isValid = eversend.verifyWebhookSignature(req.body, signature);

    if (!isValid) {
      console.warn('Eversend webhook: invalid signature');
      return res.status(401).send('Unauthorized');
    }

    const event = JSON.parse(req.body);
    const { type, data } = event;

    console.log(`Eversend webhook received: ${type}`, data?.transactionRef);

    if (type === 'transaction.success' || type === 'collection.success') {
      const transaction = await Transaction.findOne({
        $or: [
          { reference: data?.transactionRef },
          { gateway_transaction_id: data?.transactionId },
        ],
        gateway: 'eversend',
      });

      if (transaction && transaction.status === 'pending') {
        transaction.status = 'completed';
        transaction.gateway_response = data;
        await transaction.save();

        await User.findByIdAndUpdate(transaction.user_id, {
          $inc: { wallet_balance: transaction.amount },
        });

        // 🔥 AUTO-SETTLE ORDERS IF ATTACHED
        if (transaction.order_ids && transaction.order_ids.length > 0) {
          const session = await mongoose.startSession();
          session.startTransaction();
          try {
            await settleOrdersInSession(transaction.user_id, transaction.order_ids, req.app, session);
            await session.commitTransaction();
          } catch (err) {
            await session.abortTransaction();
            console.error('Webhook Settlement Error:', err.message);
          } finally {
            session.endSession();
          }
        }

        console.log(`✅ Eversend: wallet credited ${transaction.amount} for user ${transaction.user_id}`);
      }
    }

    if (type === 'transaction.failed' || type === 'collection.failed') {
      await Transaction.findOneAndUpdate(
        { reference: data?.transactionRef, gateway: 'eversend' },
        { status: 'failed', gateway_response: data }
      );
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Eversend Webhook Error:', error);
    res.status(500).send('Internal Server Error');
  }
};

module.exports = {
  // Paystack
  initializePayment,
  verifyPayment,
  handleWebhook,
  // Eversend
  eversendRequestOTP,
  eversendInitialize,
  eversendVerify,
  eversendWebhook,
};
