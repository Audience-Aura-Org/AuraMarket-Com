const axios = require('axios');
const crypto = require('crypto');
const Transaction = require('../models/Transaction.model');
const User = require('../models/User.model');
const Order = require('../models/Order.model');
const Escrow = require('../models/Escrow.model');
const Cart = require('../models/Cart.model');
const LogisticsCompany = require('../models/LogisticsCompany.model');
const logisticsService = require('../services/logistics.service');
const { PAYSTACK_SECRET_KEY } = require('../config/env');
const eversend = require('../services/eversend.service');
const { sendNotification } = require('../utils/notifier');
const { getWebUrl } = require('../utils/url');
const mongoose = require('mongoose');
const Vendor = require('../models/Vendor.model');
const Shipment = require('../models/Shipment.model');

// ─────────────────────────────────────────────────────────────────────────────
// PAYSTACK — kept intact for existing wallet flows
// ─────────────────────────────────────────────────────────────────────────────

const initializePayment = async (req, res, next) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Invalid amount.' });
    const paystackAmount = amount * 100;
    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      { email: req.user.email, amount: paystackAmount, callback_url: `${process.env.WEB_CLIENT_URL}/wallet/verify`, metadata: { user_id: req.user._id, type: 'deposit' } },
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' } }
    );
    const { authorization_url, reference } = response.data.data;
    await Transaction.create({ user_id: req.user._id, type: 'deposit', amount, reference, status: 'pending', gateway: 'paystack', description: 'Wallet deposit via Paystack' });
    res.status(200).json({ success: true, data: { checkout_url: authorization_url, reference } });
  } catch (error) {
    console.error('Paystack Init Error:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Payment initialization failed.' });
  }
};

const verifyPayment = async (req, res, next) => {
  try {
    const { reference } = req.params;
    const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } });
    const { status, amount } = response.data.data;
    if (status === 'success') {
      const transaction = await Transaction.findOne({ reference });
      if (transaction && transaction.status === 'pending') {
        transaction.status = 'completed';
        transaction.gateway_response = response.data.data;
        await transaction.save();
        const creditAmount = amount / 100;
        await User.findByIdAndUpdate(transaction.user_id, { $inc: { wallet_balance: creditAmount } });
        return res.status(200).json({ success: true, message: 'Payment verified and wallet credited.', data: { balance_added: creditAmount } });
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
    if (hash !== req.headers['x-paystack-signature']) return res.status(400).send('Invalid signature');
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
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const sanitizePhone = (phone, country = 'CM') => {
  if (!phone) return phone;
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('00')) cleaned = '+' + cleaned.slice(2);
  if (!cleaned.startsWith('+')) {
    const prefixes = { 'CM': '237', 'KE': '254', 'UG': '256', 'RW': '250', 'GH': '233', 'NG': '234', 'CI': '225' };
    const prefix = prefixes[country] || '237';
    if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);
    cleaned = `+${prefix}${cleaned}`;
  }
  return cleaned;
};

/**
 * Internal Helper: Settle orders using the user's wallet balance after a successful payment.
 * @param {string} userId
 * @param {string[]} orderIds
 * @param {object} app - Express app (for notifications)
 * @param {object} externalSession - Mongoose session (optional)
 * @param {boolean} skipBalanceCheck - Skip balance check (for sandbox/prepaid flows)
 * @param {string} webUrl - Base URL for notification links
 */
const settleOrdersInSession = async (userId, orderIds, app, externalSession = null, skipBalanceCheck = false, webUrl = '') => {
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

      if (!skipBalanceCheck || user.wallet_balance >= order.total_amount) {
        user.wallet_balance -= order.total_amount;
      }

      order.payment_status = 'paid';
      order.order_status = 'processing';
      await order.save({ session });

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

      if (order.shipping_method === 'logistics_partner' && order.logistics_company_id) {
        const quartier = order.shipping_address?.quartier;
        if (quartier) {
          const existingShipment = await Shipment.findOne({ order_id: order._id }).session(session);
          if (!existingShipment) {
            await logisticsService.createShipmentsForOrder(order, quartier, order.logistics_company_id, session);
          }
        }
      }

      const vendor = await Vendor.findById(order.vendor_id).session(session);
      const orderForNotify = order.toObject();
      orderForNotify.vendor_id = vendor;

      setImmediate(async () => {
        try {
          if (vendor) {
            await sendNotification(app, vendor.user_id, {
              title: 'Order Paid & Confirmed',
              message: `Payment received for order #${order._id.toString().slice(-6).toUpperCase()} from ${user.name}.`,
              type: 'order_status',
              metadata: { order_id: order._id, link: '/vendor/orders' },
              sendEmail: true,
              orderDetails: orderForNotify,
              role: 'vendor',
              webUrl,
            });
          }
          await sendNotification(app, user._id, {
            title: 'Order Payment Confirmed',
            message: `Your payment for order #${order._id.toString().slice(-6).toUpperCase()} has been verified.`,
            type: 'order_status',
            metadata: { order_id: order._id, link: '/orders' },
            sendEmail: true,
            orderDetails: orderForNotify,
            role: 'customer',
            webUrl,
          });
          if (order.shipping_method === 'logistics_partner' && order.logistics_company_id) {
            const logisticsFirm = await LogisticsCompany.findById(order.logistics_company_id);
            if (logisticsFirm) {
              await sendNotification(app, logisticsFirm.user_id, {
                title: 'New Shipment Assigned',
                message: `Order #${order._id.toString().slice(-6).toUpperCase()} is ready for pickup.`,
                type: 'system_alert',
                metadata: { order_id: order._id, link: '/logistics/dashboard' },
                sendEmail: true,
                role: 'logistics',
                webUrl,
              });
            }
          }
        } catch (bgError) {
          console.error('Settlement bg notification error:', bgError);
        }
      });
    }

    await user.save({ session });

    // Clear user cart once all orders in the session are paid/settled
    const cart = await Cart.findOne({ user_id: userId }).session(session);
    if (cart) {
      cart.items = [];
      await cart.save({ session });
    }

    if (!externalSession) await session.commitTransaction();
    console.log(`✅ Aura settlement: orders ${orderIds.join(', ')} finalized for user ${userId}`);
  } catch (error) {
    if (!externalSession) await session.abortTransaction();
    console.error('Settlement Error:', error.message);
    throw error;
  } finally {
    if (!externalSession) session.endSession();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// EVERSEND — No OTP. Direct collections only.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/payments/eversend/wallets
 * @desc    Return all Eversend wallets linked to the merchant account.
 *          Used by frontend to resolve the correct wallet per currency.
 * @access  Private
 */
const eversendGetWallets = async (req, res) => {
  try {
    const result = await eversend.getWallets();
    const wallets = result?.data || result?.wallets || [];
    return res.status(200).json({ success: true, data: { wallets } });
  } catch (error) {
    const statusCode = error.response?.status || 500;
    console.error('Eversend GetWallets Error:', error.response?.data || error.message);
    if (statusCode === 500) {
      return res.status(503).json({ success: false, message: 'Eversend service is temporarily unavailable. Please try again in a few minutes.' });
    }
    res.status(statusCode).json({ success: false, message: 'Failed to fetch Eversend wallets.', detail: error.response?.data });
  }
};

/**
 * @route   POST /api/payments/eversend/initialize
 * @desc    Initiate an Eversend collection (mobile money / NGN).
 *          OTP is DISABLED — no OTP step required or used.
 * @access  Private
 * @body    { amount, currency, phone, country, order_ids?, redirect_url? }
 */
const eversendInitialize = async (req, res) => {
  try {
    let { amount, currency, phone, country, order_ids, redirect_url: customRedirect } = req.body;

    phone = sanitizePhone(phone, country);

    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Invalid amount.' });
    if (!currency || !phone || !country) return res.status(400).json({ success: false, message: 'currency, phone, and country are required.' });

    const user = req.user;
    const transactionRef = `AURA-${Date.now()}-${user._id}`;
    const redirectUrl = customRedirect || `${process.env.WEB_CLIENT_URL}/wallet/verify?gateway=eversend&ref=${transactionRef}`;

    // ── SANDBOX SIMULATION MODE ───────────────────────────────────────────────
    const isSandbox = process.env.EVERSEND_SANDBOX_MODE === 'true';
    if (isSandbox) {
      console.log('[Eversend] SANDBOX MODE — simulating successful collection');
      const sandboxTxId = `SBX-${Date.now()}`;
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        await Transaction.create([{
          user_id: user._id, type: 'deposit', amount: Number(amount), currency, reference: transactionRef,
          gateway_transaction_id: sandboxTxId, status: 'completed', gateway: 'eversend',
          order_ids: order_ids || [],
          description: `[SANDBOX] Checkout simulation for ${order_ids?.length || 0} order(s)`,
        }], { session });
        await User.findByIdAndUpdate(user._id, { $inc: { wallet_balance: Number(amount) } }, { session });
        if (order_ids && order_ids.length > 0) {
          await settleOrdersInSession(user._id, order_ids, req.app, session, true, getWebUrl(req));
        }
        await session.commitTransaction();
        session.endSession();
        return res.status(200).json({ success: true, data: { checkout_url: null, transaction_id: sandboxTxId, reference: transactionRef } });
      } catch (err) {
        await session.abortTransaction();
        session.endSession();
        return res.status(500).json({ success: false, message: `Sandbox simulation failed: ${err.message}` });
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    const nameParts = (user.name || '').split(' ');
    const firstName = nameParts[0] || 'Aura';
    const lastName = nameParts.slice(1).join(' ') || 'User';

    const collectionOpts = { amount, currency, phone, country, firstName, lastName, email: user.email, redirectUrl, transactionRef };

    console.log('[Eversend] Initiating live collection:', { amount, currency, phone, country });

    // Route NGN to dedicated endpoint
    let result;
    if (currency === 'NGN') {
      result = await eversend.initiateNGNCollection(collectionOpts);
    } else {
      result = await eversend.initiateCollection(collectionOpts);
    }

    if (!result || !result.success) {
      console.error('Eversend Collection Failed:', JSON.stringify(result));
      return res.status(400).json({ success: false, message: result?.message || 'Eversend initiation failed.', detail: result });
    }

    const responseData = result?.data || result;
    const gatewayTxId = responseData?.transactionId || responseData?.transaction_id || responseData?.id || null;
    const checkoutUrl = responseData?.checkoutUrl || responseData?.checkout_url || responseData?.paymentUrl || responseData?.payment_url || null;

    console.log(`[Eversend] gatewayTxId=${gatewayTxId} checkoutUrl=${checkoutUrl}`);

    await Transaction.create({
      user_id: user._id, type: 'deposit', amount, currency, reference: transactionRef,
      gateway_transaction_id: gatewayTxId, status: 'pending', gateway: 'eversend',
      order_ids: order_ids || [],
      description: order_ids?.length > 0
        ? `Checkout payment for ${order_ids.length} order(s) via Eversend (${currency})`
        : `Wallet deposit via Eversend (${currency})`,
    });

    return res.status(200).json({ success: true, data: { checkout_url: checkoutUrl, transaction_id: gatewayTxId, reference: transactionRef } });

  } catch (error) {
    const evError = error.response?.data;
    const statusCode = error.response?.status || 500;
    console.error('Eversend Init Error:', statusCode, evError || error.message);

    let userMessage = 'Eversend payment initialization failed.';
    if (statusCode === 401) {
      userMessage = 'Eversend authorization failed. Token has been refreshed — please retry.';
    } else if (statusCode === 500) {
      userMessage = 'Eversend service is temporarily unavailable. Please try again in a few minutes.';
    } else if (statusCode === 422) {
      userMessage = evError?.message || 'Invalid payment details. Please check your phone number and currency.';
    } else if (evError?.message && typeof evError.message === 'string') {
      userMessage = evError.message;
    }

    res.status(statusCode < 500 ? statusCode : 500).json({ success: false, message: userMessage, detail: evError });
  }
};

/**
 * @route   GET /api/payments/eversend/verify/:reference
 * @desc    Poll Eversend for transaction status and credit wallet if successful.
 *          Returns payment states: SUCCESSFUL | FAILED | PENDING | TIMEOUT
 * @access  Private
 */
const eversendVerify = async (req, res) => {
  try {
    const { reference } = req.params;
    const transaction = await Transaction.findOne({ reference, gateway: 'eversend' });

    if (!transaction) return res.status(404).json({ success: false, message: 'Transaction not found.' });

    if (transaction.status === 'completed') {
      return res.status(200).json({ success: true, message: 'Payment already processed and orders settled.', status: 'SUCCESSFUL' });
    }

    if (transaction.status === 'failed') {
      return res.status(400).json({
        success: false,
        status: 'FAILED',
        message: `Your deposit of ${transaction.amount} ${transaction.currency || 'XAF'} failed.`,
        reason: transaction.gateway_response?.message || 'Payment was declined by the gateway.',
      });
    }

    // Check for timeout — if pending for > 60 seconds with no gateway ID
    if (!transaction.gateway_transaction_id) {
      const ageSeconds = (Date.now() - new Date(transaction.createdAt).getTime()) / 1000;
      if (ageSeconds > 60) {
        return res.status(200).json({ success: false, status: 'TIMEOUT', message: 'Payment verification timed out. Please check your transaction history or recheck payment status.', reference });
      }
      return res.status(200).json({ success: true, status: 'PENDING', message: 'Awaiting mobile money confirmation from gateway.' });
    }

    // Poll Eversend using /transactions/:id
    const result = await eversend.getTransactionStatus(transaction.gateway_transaction_id);
    console.log(`[Eversend Verify] ref=${reference} txId=${transaction.gateway_transaction_id} status=`, result?.data?.status || result?.status);
    const txStatus = result?.data?.status || result?.status;

    // Check timeout — if API still returns pending after 60 seconds
    const ageSeconds = (Date.now() - new Date(transaction.createdAt).getTime()) / 1000;
    if (txStatus === 'PENDING' && ageSeconds > 60) {
      return res.status(200).json({ success: false, status: 'TIMEOUT', message: 'Payment verification timed out. Please check your transaction history or recheck payment status.', reference });
    }

    if (txStatus === 'SUCCESSFUL') {
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        transaction.status = 'completed';
        transaction.gateway_response = result.data;
        await transaction.save({ session });
        await User.findByIdAndUpdate(transaction.user_id, { $inc: { wallet_balance: transaction.amount } }, { session });
        if (transaction.order_ids && transaction.order_ids.length > 0) {
          await settleOrdersInSession(transaction.user_id, transaction.order_ids, req.app, session, false, getWebUrl(req));
        }
        await session.commitTransaction();
      } catch (err) {
        await session.abortTransaction();
        throw err;
      } finally {
        session.endSession();
      }
      return res.status(200).json({ success: true, status: 'SUCCESSFUL', message: 'Payment verified and wallet credited.', data: { balance_added: transaction.amount } });
    }

    if (txStatus === 'FAILED') {
      const reason = result?.data?.message || result?.message || 'Payment was declined by the gateway.';
      transaction.status = 'failed';
      transaction.gateway_response = result.data || result;
      await transaction.save();
      return res.status(400).json({
        success: false,
        status: 'FAILED',
        message: `Your deposit of ${transaction.amount} ${transaction.currency || 'XAF'} failed. Reason: ${reason}`,
        reason,
        reference,
      });
    }

    return res.status(200).json({ success: true, status: 'PENDING', message: 'Payment is still being processed. Please wait.' });

  } catch (error) {
    console.error('Eversend Verify Error:', error.response?.data || error.message);
    const statusCode = error.response?.status || 500;
    if (statusCode === 500) {
      return res.status(503).json({ success: false, message: 'Eversend service is temporarily unavailable. Please try again in a few minutes.' });
    }
    res.status(500).json({ success: false, message: 'Eversend verification error.' });
  }
};

/**
 * @route   GET /api/payments/eversend/recheck/:reference
 * @desc    Manually re-poll Eversend for the latest transaction status.
 *          Used by "Recheck Payment" button on failed/timeout screens.
 * @access  Private
 */
const eversendRecheck = async (req, res) => {
  try {
    const { reference } = req.params;
    const transaction = await Transaction.findOne({ reference, gateway: 'eversend' });

    if (!transaction) return res.status(404).json({ success: false, message: 'Transaction not found.' });

    // Already settled
    if (transaction.status === 'completed') {
      return res.status(200).json({ success: true, status: 'SUCCESSFUL', message: 'Payment has already been confirmed and processed.', data: { balance_added: transaction.amount } });
    }

    if (!transaction.gateway_transaction_id) {
      return res.status(200).json({ success: false, status: 'PENDING', message: 'Still processing — no confirmation from gateway yet. Check back shortly.' });
    }

    const result = await eversend.getTransactionStatus(transaction.gateway_transaction_id);
    const txStatus = result?.data?.status || result?.status;
    console.log(`[Eversend Recheck] ref=${reference} status=${txStatus}`);

    if (txStatus === 'SUCCESSFUL') {
      if (transaction.status !== 'completed') {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
          transaction.status = 'completed';
          transaction.gateway_response = result.data;
          await transaction.save({ session });
          await User.findByIdAndUpdate(transaction.user_id, { $inc: { wallet_balance: transaction.amount } }, { session });
          if (transaction.order_ids?.length > 0) {
            await settleOrdersInSession(transaction.user_id, transaction.order_ids, req.app, session, false, getWebUrl(req));
          }
          await session.commitTransaction();
        } catch (err) {
          await session.abortTransaction();
          throw err;
        } finally {
          session.endSession();
        }
      }
      return res.status(200).json({ success: true, status: 'SUCCESSFUL', message: 'Payment confirmed! Your order has been completed.', data: { balance_added: transaction.amount } });
    }

    if (txStatus === 'FAILED') {
      const reason = result?.data?.message || result?.message || 'Payment was declined by the gateway.';
      transaction.status = 'failed';
      transaction.gateway_response = result.data || result;
      await transaction.save();
      return res.status(400).json({ success: false, status: 'FAILED', message: `Payment failed. Reason: ${reason}`, reason });
    }

    return res.status(200).json({ success: true, status: 'PENDING', message: 'Still processing. Check back shortly.' });

  } catch (error) {
    console.error('Eversend Recheck Error:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Failed to recheck payment status.' });
  }
};

/**
 * @route   POST /api/payments/eversend/webhook
 * @desc    Handle Eversend webhook events
 * @access  Public (signature verified)
 */
const eversendWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-eversend-signature'];
    const isValid = eversend.verifyWebhookSignature(req.body, signature);
    if (!isValid) { console.warn('Eversend webhook: invalid signature'); return res.status(401).send('Unauthorized'); }

    const event = JSON.parse(req.body);
    const { type, data } = event;
    console.log(`Eversend webhook received: ${type}`, data?.transactionRef);

    if (type === 'transaction.success' || type === 'collection.success') {
      const transaction = await Transaction.findOne({
        $or: [{ reference: data?.transactionRef }, { gateway_transaction_id: data?.transactionId }],
        gateway: 'eversend',
      });
      if (transaction && transaction.status === 'pending') {
        transaction.status = 'completed';
        transaction.gateway_response = data;
        await transaction.save();
        await User.findByIdAndUpdate(transaction.user_id, { $inc: { wallet_balance: transaction.amount } });
        if (transaction.order_ids?.length > 0) {
          const session = await mongoose.startSession();
          session.startTransaction();
          try {
            await settleOrdersInSession(transaction.user_id, transaction.order_ids, req.app, session, false, '');
            await session.commitTransaction();
          } catch (err) {
            await session.abortTransaction();
            console.error('Webhook Settlement Error:', err.message);
          } finally { session.endSession(); }
        }
        console.log(`✅ Eversend: wallet credited ${transaction.amount} for user ${transaction.user_id}`);
      }
    }

    if (type === 'transaction.failed' || type === 'collection.failed' || type === 'payout.failed') {
      await Transaction.findOneAndUpdate(
        { reference: data?.transactionRef, gateway: 'eversend' },
        { status: 'failed', gateway_response: data }
      );
      // If it was a payout, we might want to alert the admin or notify the vendor
      if (type === 'payout.failed') {
        console.error(`❌ Eversend Payout Failed: ${data?.transactionRef}`, data?.message);
        // TODO: Trigger admin alert/email
      }
    }

    if (type === 'payout.success') {
      const transaction = await Transaction.findOneAndUpdate(
        { reference: data?.transactionRef, gateway: 'eversend' },
        { status: 'completed', gateway_response: data },
        { new: true }
      );
      if (transaction) {
        console.log(`✅ Eversend Payout Success: ${data?.transactionRef} to user ${transaction.user_id}`);
        // TODO: Notify vendor via in-app notification
        await sendNotification({
          userId: transaction.user_id,
          title: 'Payout Successful',
          message: `Your withdrawal of ${transaction.amount} ${transaction.currency} has been processed successfully.`,
          type: 'payment'
        });
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Eversend Webhook Error:', error);
    res.status(500).send('Internal Server Error');
  }
};

/**
 * @route   GET /api/payments/eversend/beneficiaries
 * @desc    List all saved Eversend beneficiaries
 */
const eversendGetBeneficiaries = async (req, res) => {
  try {
    const beneficiaries = await eversend.getBeneficiaries();
    res.status(200).json({ success: true, data: beneficiaries });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch beneficiaries.' });
  }
};

/**
 * @route   POST /api/payments/eversend/beneficiaries
 * @desc    Create a new Eversend beneficiary
 */
const eversendCreateBeneficiary = async (req, res) => {
  try {
    const beneficiary = await eversend.createBeneficiary(req.body);
    res.status(201).json({ success: true, data: beneficiary });
  } catch (error) {
    res.status(error.response?.status || 500).json({ 
      success: false, 
      message: error.response?.data?.message || 'Failed to create beneficiary.' 
    });
  }
};

/**
 * @route   DELETE /api/payments/eversend/beneficiaries/:id
 * @desc    Delete an Eversend beneficiary
 */
const eversendDeleteBeneficiary = async (req, res) => {
  try {
    await eversend.deleteBeneficiary(req.params.id);
    res.status(200).json({ success: true, message: 'Beneficiary deleted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete beneficiary.' });
  }
};

/**
 * @route   GET /api/payments/eversend/transactions
 * @desc    Fetch platform transaction history
 */
const eversendGetTransactions = async (req, res) => {
  try {
    const transactions = await eversend.getTransactions(req.query);
    res.status(200).json({ success: true, data: transactions });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch transactions.' });
  }
};

/**
 * @route   POST /api/payments/eversend/payout/beneficiary
 * @desc    Execute a payout to a saved beneficiary
 */
const eversendPayoutBeneficiary = async (req, res) => {
  try {
    const { token, beneficiaryId, transactionRef } = req.body;
    if (!token || !beneficiaryId) {
      return res.status(400).json({ success: false, message: 'Token and Beneficiary ID are required.' });
    }
    const result = await eversend.executeBeneficiaryPayout(token, beneficiaryId, transactionRef);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(error.response?.status || 500).json({ 
      success: false, 
      message: error.response?.data?.message || 'Failed to execute beneficiary payout.' 
    });
  }
};

module.exports = {
  // Paystack
  initializePayment,
  verifyPayment,
  handleWebhook,
  // Eversend
  eversendGetWallets,
  eversendInitialize,
  eversendVerify,
  eversendRecheck,
  eversendWebhook,
  eversendGetBeneficiaries,
  eversendCreateBeneficiary,
  eversendDeleteBeneficiary,
  eversendGetTransactions,
  eversendPayoutBeneficiary,
  settleOrdersInSession,
};
