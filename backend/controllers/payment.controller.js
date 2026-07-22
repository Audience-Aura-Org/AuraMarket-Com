const axios = require('axios');
const crypto = require('crypto');
const Transaction = require('../models/Transaction.model');
const User = require('../models/User.model');
const Order = require('../models/Order.model');
const Cart = require('../models/Cart.model');
const LogisticsCompany = require('../models/LogisticsCompany.model');
const eversend = require('../services/eversend.service');
const payunit = require('../services/payunit.service');
const { sendNotification, notifyAdmins } = require('../utils/notifier');
const { getWebUrl } = require('../utils/url');
const mongoose = require('mongoose');
const { PAYSTACK_SECRET_KEY } = require('../config/env');
// -- New unified services -----------------------------------------------------
const { settleOrders } = require('../services/payment/settle.service');
const { getAvailableGateways } = require('../services/payment/gateway.registry');
const { applyMobileMoneyCollectionFee } = require('../utils/mobileMoneyFees');
const { activateSubscription } = require('../services/subscription.service');

// -----------------------------------------------------------------------------
// PAYSTACK â€” kept intact for existing wallet flows
// -----------------------------------------------------------------------------

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
        setImmediate(() => {
          notifyAdmins(req.app, {
            title: 'New Wallet Deposit',
            message: `${(amount / 100).toLocaleString()} XAF deposited via Paystack (ref: ${reference}).`,
            type: 'system_alert',
            metadata: { link: '/admin/transactions' },
            sendEmail: true,
          }).catch(console.error);
        });
      }
    }
    res.status(200).send('Webhook processed');
  } catch (error) {
    console.error('Paystack Webhook Error:', error);
    res.status(500).send('Internal Server Error');
  }
};

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------

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

const normalizeOrderIds = (orderIds = []) => {
  if (!Array.isArray(orderIds)) return [];
  return orderIds
    .map((id) => id?.toString?.() || String(id || ''))
    .filter((id) => mongoose.Types.ObjectId.isValid(id));
};

const buildCheckoutKey = (orderIds = []) => {
  const ids = normalizeOrderIds(orderIds).sort();
  return ids.length ? ids.join(':') : null;
};

const getAuthoritativeCheckoutAmount = async (userId, orderIds = []) => {
  const ids = normalizeOrderIds(orderIds);
  if (ids.length === 0) return null;

  const orders = await Order.find({
    _id: { $in: ids },
    customer_id: userId,
  }).select('_id total_amount payment_status');

  if (orders.length !== ids.length) {
    throw new Error('One or more checkout orders could not be verified.');
  }

  const nonPayable = orders.find((order) => order.payment_status !== 'pending');
  if (nonPayable) {
    throw new Error(`Order #${nonPayable._id.toString().slice(-6).toUpperCase()} is already ${nonPayable.payment_status}.`);
  }

  return Math.round(orders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0));
};

const markCheckoutOrdersFailed = async (userId, orderIds = []) => {
  const ids = normalizeOrderIds(orderIds);
  if (ids.length === 0) return;

  await Order.updateMany(
    {
      _id: { $in: ids },
      customer_id: userId,
      payment_status: 'pending',
    },
    { $set: { payment_status: 'failed' } }
  );
};

const rejectPendingCheckoutTransactions = async (userId, orderIds = [], reason = 'Checkout cancelled by customer.') => {
  const checkoutKey = buildCheckoutKey(orderIds);
  if (!checkoutKey) return;
  const cancelledAt = new Date();

  const filter = {
    user_id: userId,
    gateway: { $in: ['eversend', 'payunit'] },
    status: 'pending',
    'metadata.checkout_key': checkoutKey,
  };

  await Transaction.updateMany(
    { ...filter, metadata: null },
    { $set: { metadata: {} } }
  );

  await Transaction.updateMany(
    filter,
    {
      $set: {
        status: 'rejected',
        'metadata.cancelled_at': cancelledAt,
        'metadata.cancel_reason': reason,
      },
    }
  );
};

const failCheckoutPayment = async (req, res) => {
  try {
    const { order_ids = [], reason = 'Checkout closed before payment completed.' } = req.body || {};
    const ids = normalizeOrderIds(order_ids);
    if (ids.length === 0) {
      return res.status(400).json({ success: false, message: 'No checkout orders were provided.' });
    }

    await markCheckoutOrdersFailed(req.user._id, ids);
    await rejectPendingCheckoutTransactions(req.user._id, ids, reason);

    return res.status(200).json({
      success: true,
      message: 'Checkout orders marked as failed.',
      data: { order_ids: ids, reason },
    });
  } catch (err) {
    console.error('[failCheckoutPayment]', err.message);
    return res.status(500).json({ success: false, message: 'Could not close checkout cleanly.' });
  }
};

const setTransactionMetadata = (transaction, patch = {}) => {
  transaction.metadata = { ...(transaction.metadata || {}), ...patch };
  transaction.markModified('metadata');
};

const emitWalletCredit = (app, transaction) => {
  const io = app?.get?.('io');
  if (!io || !transaction?.user_id) return;

  const payload = {
    amount: transaction.amount,
    reference: transaction.reference,
    gateway: transaction.gateway,
    type: 'deposit',
  };
  const userRoom = transaction.user_id.toString();
  io.to(userRoom).emit('wallet:credited', payload);
  io.to(`user:${userRoom}`).emit('wallet:credited', payload);
};

const isSubscriptionTransaction = (transaction) =>
  transaction?.type === 'subscription' || transaction?.metadata?.purpose === 'subscription';

const settleSubscriptionTransaction = async (transaction, session = null, app = null) => {
  const planId = transaction.metadata?.plan_id;
  const role = transaction.metadata?.role;
  if (!planId || !role) {
    throw new Error('Subscription transaction is missing plan or role metadata.');
  }

  const subscription = await activateSubscription({
    userId: transaction.user_id,
    planId,
    role,
    transaction,
    source: transaction.gateway || 'manual',
    session,
    note: 'Activated after confirmed subscription payment.',
  });

  const io = app?.get?.('io');
  if (io) {
    const payload = {
      role,
      plan_id: planId,
      reference: transaction.reference,
      subscription_id: subscription._id,
    };
    io.to(transaction.user_id.toString()).emit('subscription:activated', payload);
    io.to(`user:${transaction.user_id}`).emit('subscription:activated', payload);
  }

  return subscription;
};

/**
 * @desc    GET /api/payments/gateways
 *          Return all enabled payment gateways for the frontend checkout UI.
 *          Adding a new gateway requires zero frontend changes â€” just register it in gateway.registry.js.
 * @access  Private
 */
const listGateways = async (req, res) => {
  try {
    const { currency } = req.query;
    const gateways = getAvailableGateways(currency || null);
    return res.status(200).json({ success: true, data: { gateways } });
  } catch (err) {
    console.error('[listGateways]', err.message);
    return res.status(500).json({ success: false, message: 'Failed to load payment gateways.' });
  }
};

/**
 * Internal Helper: Settle orders after a confirmed payment.
 * Now delegates to settle.service â€” no duplicate logic here.
 */
const settleOrdersInSession = async (userId, orderIds, app, externalSession = null, skipBalanceCheck = false, webUrl = '', paymentGateway = 'wallet') => {
  const session = externalSession || await mongoose.startSession();
  if (!externalSession) session.startTransaction();
  try {
    await settleOrders(userId, orderIds, session, app, skipBalanceCheck, webUrl, paymentGateway);
    if (!externalSession) await session.commitTransaction();
    console.log(`[payment.controller] Settled ${orderIds.length} order(s) for user ${userId} via ${paymentGateway}`);
  } catch (error) {
    if (!externalSession) await session.abortTransaction();
    console.error('[settleOrdersInSession]', error.message);
    throw error;
  } finally {
    if (!externalSession) session.endSession();
  }
};

const settleGatewayTransaction = async (transaction, gatewayData, app, webUrl, paymentGateway) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // Atomic claim: findOneAndUpdate with status filter ensures only ONE concurrent
    // call (webhook retry, polling verify, etc.) can ever settle this transaction.
    // If the document is already 'completed' the update matches nothing and we bail.
    const claimed = await Transaction.findOneAndUpdate(
      { _id: transaction._id, status: { $ne: 'completed' } },
      { $set: { status: 'completed', gateway_response: gatewayData } },
      { session, new: true }
    );
    if (!claimed) {
      // Another concurrent request already settled this transaction — nothing to do.
      await session.abortTransaction();
      return;
    }

    if (isSubscriptionTransaction(claimed)) {
      await settleSubscriptionTransaction(claimed, session, app);
    } else if (claimed.order_ids?.length > 0) {
      await settleOrdersInSession(claimed.user_id, claimed.order_ids, app, session, true, webUrl, paymentGateway);
    } else {
      await User.findByIdAndUpdate(claimed.user_id, { $inc: { wallet_balance: claimed.amount } }, { session });
    }

    await session.commitTransaction();
    if (!isSubscriptionTransaction(claimed) && !(claimed.order_ids?.length > 0)) {
      emitWalletCredit(app, claimed);
      setImmediate(() => {
        notifyAdmins(app, {
          title: 'New Wallet Deposit',
          message: `${claimed.amount.toLocaleString()} XAF deposited via ${paymentGateway || 'gateway'} (ref: ${claimed.reference}).`,
          type: 'system_alert',
          metadata: { link: '/admin/transactions' },
          sendEmail: true,
        }).catch(console.error);
      });
    }
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

const payunitInitialize = async (req, res) => {
  try {
    let { amount, currency = 'XAF', phone, country = 'CM', provider, order_ids, redirect_url: customRedirect } = req.body || {};
    // Auto-detect operator from phone prefix; explicit provider from client always wins
    const resolvedProvider = provider || (phone ? payunit.detectCmProvider(phone) : 'CM_MTNMOMO');
    const checkoutAmount = await getAuthoritativeCheckoutAmount(req.user._id, order_ids);
    const netAmount = checkoutAmount ?? Number(amount || 0);
    const feeBreakdown = applyMobileMoneyCollectionFee(netAmount, 'payunit', currency);

    if (!feeBreakdown.netAmount || feeBreakdown.netAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount.' });
    }
    if (String(currency).toUpperCase() !== 'XAF') {
      return res.status(400).json({ success: false, message: 'PayUnit currently supports XAF collections only.' });
    }

    // Always use the configured public web URL for PayUnit return_url.
    // PayUnit validates return_url against registered domains — never send
    // a localhost/capacitor origin (which happens when request comes from APK).
    const publicWebUrl = process.env.WEB_CLIENT_URL || 'https://auradime.com';
    const notifyUrl = `${process.env.API_PUBLIC_URL || process.env.BACKEND_PUBLIC_URL || `${req.protocol}://${req.get('host')}`}/api/v1/payments/payunit/webhook`;
    const transactionRef = payunit.cleanTransactionId(`AURAPU${Date.now()}${String(req.user._id).slice(-6)}`);
    // Strip any localhost/capacitor prefix that might arrive from mobile app redirect_url
    const safeRedirect = customRedirect && !/localhost|127\.0\.0\.1|capacitor:\/\//i.test(customRedirect)
      ? customRedirect
      : null;
    const returnUrl = safeRedirect || `${publicWebUrl}/wallet/verify?gateway=payunit&ref=${transactionRef}`;

    // -----------------------------------------------------------------------
    // Correct PayUnit two-step flow:
    //   1. POST /initialize — registers the transaction in PayUnit's system
    //      (required — skipping this causes 404 "Transaction does not exist")
    //   2. POST /makepayment — triggers direct mobile push
    //      transaction_id = OUR transactionRef (not PayUnit's returned ID)
    //      phone_number   = local 9-digit format, e.g. 651188134 (not +237...)
    // -----------------------------------------------------------------------

    // Step 1: Always initialize first
    const init = await payunit.initializePayment({
      amount: feeBreakdown.grossAmount,
      currency,
      transactionId: transactionRef,
      returnUrl,
      notifyUrl,
      country,
    });

    // Step 2: If phone provided, trigger direct mobile push with the SAME transactionRef
    let direct = null;
    let mobilePaymentTimedOut = false;
    if (phone) {
      try {
        direct = await payunit.makeMobilePayment({
          amount: feeBreakdown.grossAmount,
          currency,
          transactionId: transactionRef,  // our own ID — same as sent to /initialize
          returnUrl,
          notifyUrl,
          phone,  // normalizePhone() in service converts to local 9-digit (e.g. 651188134)
          provider: resolvedProvider,
        });
      } catch (mpeError) {
        if (payunit.isTimeoutError(mpeError)) {
          // Timeout ≠ failure: PayUnit may have received the request and will still
          // push the collection prompt to the subscriber's phone.
          mobilePaymentTimedOut = true;
          console.warn('[PayUnit makepayment] Timed out — payment may still be processing:', mpeError.message);
        } else {
          throw mpeError;
        }
      }
    }

    const gatewayData = direct?.data || init?.data || {};
    await Transaction.create({
      user_id: req.user._id,
      type: order_ids?.length > 0 ? 'payment' : 'deposit',
      amount: feeBreakdown.netAmount,
      currency,
      reference: transactionRef,
      gateway_transaction_id: gatewayData.transaction_id || transactionRef,
      status: 'pending',
      gateway: 'payunit',
      order_ids: order_ids || [],
      description: order_ids?.length > 0
        ? `Checkout payment for ${order_ids.length} order(s) via PayUnit (${currency})`
        : `Wallet deposit via PayUnit (${currency})`,
      gateway_response: { initialize: init?.raw || null, makepayment: direct?.raw || null },
      metadata: {
        net_amount: feeBreakdown.netAmount,
        collection_fee: feeBreakdown.collectionFee,
        gross_amount: feeBreakdown.grossAmount,
        provider: resolvedProvider,
        phone: phone ? payunit.normalizePhoneIntl(phone, country) : null,
        ...(mobilePaymentTimedOut ? { timed_out: true } : {}),
      },
    });

    return res.status(200).json({
      success: true,
      message: mobilePaymentTimedOut
        ? 'PayUnit request timed out — payment may still be processing. Please check your phone or poll for status.'
        : phone ? 'PayUnit collection request sent to your phone.' : 'PayUnit payment initialized.',
      data: {
        checkout_url: gatewayData.transaction_url || init?.data?.transaction_url || returnUrl,
        reference: transactionRef,
        transaction_id: gatewayData.transaction_id || transactionRef,
        amount: feeBreakdown.netAmount,
        collection_fee: feeBreakdown.collectionFee,
        gross_amount: feeBreakdown.grossAmount,
      },
    });
  } catch (error) {
    console.error('[PayUnit Initialize]', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      success: false,
      message: error.response?.data?.message || error.message || 'PayUnit payment initialization failed.',
      detail: error.response?.data,
    });
  }
};

const payunitVerify = async (req, res) => {
  try {
    const { reference } = req.params;
    const transaction = await Transaction.findOne({ reference, gateway: 'payunit' });
    if (!transaction) return res.status(404).json({ success: false, message: 'Transaction not found.' });
    if (transaction.status === 'completed') {
      return res.status(200).json({ success: true, status: 'SUCCESSFUL', message: isSubscriptionTransaction(transaction) ? 'Subscription activated.' : 'Payment confirmed.' });
    }
    if (transaction.status === 'failed') {
      return res.status(400).json({ success: false, status: 'FAILED', message: 'Payment failed.', reason: transaction.gateway_response?.message });
    }

    const result = await payunit.getPaymentStatus(transaction.reference);
    const data = result?.data || {};
    const status = payunit.normalizeStatus(data);

    if (status === 'SUCCESSFUL') {
      await settleGatewayTransaction(transaction, result.raw || data, req.app, getWebUrl(req), 'payunit');
      return res.status(200).json({
        success: true,
        status: 'SUCCESSFUL',
        message: isSubscriptionTransaction(transaction) ? 'Subscription activated.' : 'Payment confirmed.',
        data: isSubscriptionTransaction(transaction) ? { subscription: true } : { balance_added: transaction.amount },
      });
    }

    if (status === 'FAILED') {
      transaction.status = 'failed';
      transaction.gateway_response = result.raw || data;
      await transaction.save();
      if (transaction.order_ids?.length) await markCheckoutOrdersFailed(transaction.user_id, transaction.order_ids);
      return res.status(400).json({ success: false, status: 'FAILED', message: data?.message || 'PayUnit payment failed.', reason: data?.message });
    }

    return res.status(200).json({ success: true, status: 'PENDING', message: 'Awaiting PayUnit confirmation.' });
  } catch (error) {
    console.error('[PayUnit Verify]', error.response?.data || error.message);
    return res.status(200).json({ success: true, status: 'PENDING', message: 'PayUnit verification is temporarily unavailable.' });
  }
};

const payunitWebhook = async (req, res) => {
  try {
    const event = req.body || {};
    const data = event.data || event;
    const reference = data.transaction_id || data.purchaseRef || data.id;
    if (!reference) return res.status(200).send('OK');

    const transaction = await Transaction.findOne({ reference, gateway: 'payunit' });
    if (!transaction) return res.status(200).send('OK');

    const status = payunit.normalizeStatus(data);
    if (status === 'SUCCESSFUL' && transaction.status !== 'completed') {
      await settleGatewayTransaction(transaction, event, req.app, getWebUrl(req), 'payunit');
    } else if (status === 'FAILED' && transaction.status !== 'failed') {
      transaction.status = 'failed';
      transaction.gateway_response = event;
      await transaction.save();
      if (transaction.order_ids?.length) await markCheckoutOrdersFailed(transaction.user_id, transaction.order_ids);
    }
    return res.status(200).send('OK');
  } catch (error) {
    console.error('[PayUnit Webhook]', error);
    return res.status(500).send('Internal Server Error');
  }
};

// -----------------------------------------------------------------------------
// EVERSEND â€” No OTP. Direct collections only.
// -----------------------------------------------------------------------------

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
 *          OTP is DISABLED â€” no OTP step required or used.
 * @access  Private
 * @body    { amount, currency, phone, country, order_ids?, redirect_url? }
 */
const eversendInitialize = async (req, res) => {
  try {
    let { amount, currency, phone, country, order_ids, redirect_url: customRedirect } = req.body;

    phone = sanitizePhone(phone, country);
    const checkoutAmount = await getAuthoritativeCheckoutAmount(req.user._id, order_ids);
    const netAmount = checkoutAmount ?? Number(amount || 0);
    const feeBreakdown = applyMobileMoneyCollectionFee(netAmount, 'eversend', currency || 'XAF');
    amount = feeBreakdown.grossAmount;

    if (!feeBreakdown.netAmount || feeBreakdown.netAmount <= 0) return res.status(400).json({ success: false, message: 'Invalid amount.' });
    if (!currency || !phone || !country) return res.status(400).json({ success: false, message: 'currency, phone, and country are required.' });

    const user = req.user;
    const transactionRef = `AURA-${Date.now()}-${user._id}`;
    const redirectUrl = customRedirect || `${process.env.WEB_CLIENT_URL}/wallet/verify?gateway=eversend&ref=${transactionRef}`;

    // -- SANDBOX SIMULATION MODE -----------------------------------------------
    const isSandbox = process.env.EVERSEND_SANDBOX_MODE === 'true';
    if (isSandbox) {
      console.log('[Eversend] SANDBOX MODE â€” initializing pending collection');
      const sandboxTxId = `SBX-${Date.now()}`;
      
      await Transaction.create({
        user_id: user._id,
        type: order_ids?.length > 0 ? 'payment' : 'deposit',
        amount: Number(feeBreakdown.netAmount),
        currency,
        reference: transactionRef,
        gateway_transaction_id: sandboxTxId,
        status: 'pending',
        gateway: 'eversend',
        order_ids: order_ids || [],
        description: order_ids?.length > 0
          ? `[SANDBOX] Checkout payment for ${order_ids.length} order(s) via Eversend (${currency})`
          : `[SANDBOX] Wallet deposit via Eversend (${currency})`,
        metadata: {
          is_sandbox: true,
          net_amount: feeBreakdown.netAmount,
          collection_fee: feeBreakdown.collectionFee,
          gross_amount: feeBreakdown.grossAmount,
        }
      });

      return res.status(200).json({ 
        success: true, 
        data: { 
          checkout_url: `${process.env.WEB_CLIENT_URL}/wallet/verify?gateway=eversend&ref=${transactionRef}&sandbox=true`, 
          transaction_id: sandboxTxId, 
          reference: transactionRef,
          amount: feeBreakdown.netAmount,
          collection_fee: feeBreakdown.collectionFee,
          gross_amount: feeBreakdown.grossAmount,
        } 
      });
    }
    // -------------------------------------------------------------------------

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

    // Eversend may return {code:200, data:{...}} or {success:true, data:{...}}.
    // Axios already throws on HTTP 4xx/5xx, so reaching here means the HTTP call
    // succeeded. Only reject if the body has an explicit success:false signal.
    if (!result || result.success === false) {
      console.error('Eversend Collection Failed:', JSON.stringify(result));
      return res.status(400).json({ success: false, message: result?.message || 'Eversend initiation failed.', detail: result });
    }

    const responseData = result?.data || result;
    const gatewayTxId = responseData?.transactionId || responseData?.transaction_id || responseData?.id || null;
    const checkoutUrl = responseData?.checkoutUrl || responseData?.checkout_url || responseData?.paymentUrl || responseData?.payment_url || null;

    console.log(`[Eversend] gatewayTxId=${gatewayTxId} checkoutUrl=${checkoutUrl}`);

    await Transaction.create({
      user_id: user._id,
      type: order_ids?.length > 0 ? 'payment' : 'deposit',
      amount: feeBreakdown.netAmount, currency, reference: transactionRef,
      gateway_transaction_id: gatewayTxId, status: 'pending', gateway: 'eversend',
      order_ids: order_ids || [],
      description: order_ids?.length > 0
        ? `Checkout payment for ${order_ids.length} order(s) via Eversend (${currency})`
        : `Wallet deposit via Eversend (${currency})`,
      metadata: {
        net_amount: feeBreakdown.netAmount,
        collection_fee: feeBreakdown.collectionFee,
        gross_amount: feeBreakdown.grossAmount,
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        checkout_url: checkoutUrl,
        transaction_id: gatewayTxId,
        reference: transactionRef,
        amount: feeBreakdown.netAmount,
        collection_fee: feeBreakdown.collectionFee,
        gross_amount: feeBreakdown.grossAmount,
      }
    });

  } catch (error) {
    const evError = error.response?.data;
    const statusCode = error.response?.status || 500;
    console.error('Eversend Init Error:', statusCode, evError || error.message);

    let userMessage = 'Eversend payment initialization failed.';
    if (statusCode === 401) {
      userMessage = 'Eversend authorization failed. Token has been refreshed â€” please retry.';
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

    // -- FAST PATH: DB already has the answer (webhook fired) -------------
    if (transaction.status === 'completed') {
      return res.status(200).json({ success: true, status: 'SUCCESSFUL', message: 'Payment confirmed and wallet credited.' });
    }
    if (transaction.status === 'failed') {
      return res.status(400).json({ success: false, status: 'FAILED', message: 'Payment was declined.', reason: transaction.gateway_response?.message || 'Declined by gateway.' });
    }

    // -- Sandbox: auto-succeed instantly ----------------------------------
    if (transaction.metadata?.is_sandbox || transaction.gateway_transaction_id?.startsWith('SBX-')) {
      const sandboxClaimed = await Transaction.findOneAndUpdate(
        { _id: transaction._id, status: { $ne: 'completed' } },
        { $set: { status: 'completed' } },
        { new: true }
      );
      if (!sandboxClaimed) {
        return res.status(200).json({ success: true, status: 'SUCCESSFUL', message: 'Sandbox payment confirmed.' });
      }
      if (isSubscriptionTransaction(sandboxClaimed)) {
        await settleSubscriptionTransaction(sandboxClaimed, null, req.app);
        return res.status(200).json({ success: true, status: 'SUCCESSFUL', message: 'Subscription activated.' });
      }
      await User.findByIdAndUpdate(sandboxClaimed.user_id, { $inc: { wallet_balance: sandboxClaimed.amount } });
      return res.status(200).json({ success: true, status: 'SUCCESSFUL', message: 'Sandbox payment confirmed.' });
    }

    // -- SLOW PATH: Webhook hasn't fired yet â€” wait 40s before asking Eversend
    // Avoids hammering Eversend API every 5s when the webhook is just delayed.
    const ageSeconds = (Date.now() - new Date(transaction.createdAt).getTime()) / 1000;
    if (ageSeconds < 40) {
      return res.status(200).json({ success: true, status: 'PENDING', message: 'Awaiting mobile money confirmation. Please approve the prompt on your phone.' });
    }

    // -- After 40s: actively query Eversend by reference ------------------
    const settleTransaction = async (gatewayData, gatewayTxId) => {
      const sess = await mongoose.startSession();
      sess.startTransaction();
      try {
        // Atomic claim — prevents double-credit if webhook and verify fire simultaneously.
        const updateFields = { status: 'completed', gateway_response: gatewayData };
        if (gatewayTxId && !transaction.gateway_transaction_id) updateFields.gateway_transaction_id = gatewayTxId;
        const claimed = await Transaction.findOneAndUpdate(
          { _id: transaction._id, status: { $ne: 'completed' } },
          { $set: updateFields },
          { session: sess, new: true }
        );
        if (!claimed) {
          await sess.abortTransaction();
          return; // Already settled by concurrent request (webhook)
        }
        if (isSubscriptionTransaction(claimed)) {
          await settleSubscriptionTransaction(claimed, sess, req.app);
        } else if (claimed.order_ids?.length > 0) {
          await settleOrdersInSession(claimed.user_id, claimed.order_ids, req.app, sess, true, getWebUrl(req), 'eversend');
        } else {
          await User.findByIdAndUpdate(claimed.user_id, { $inc: { wallet_balance: claimed.amount } }, { session: sess });
        }
        await sess.commitTransaction();
        // Push real-time notification via Socket.io
        const io = req.app.get('io');
        if (io) io.to(`user:${claimed.user_id}`).emit('wallet:credited', { amount: claimed.amount, reference });
      } catch (e) { await sess.abortTransaction(); throw e; }
      finally { sess.endSession(); }
    };

    // Try by transactionId first (fastest), then by ref as fallback
    const lookupFn = transaction.gateway_transaction_id
      ? () => eversend.getTransactionStatus(transaction.gateway_transaction_id)
      : () => eversend.getCollectionByRef(transaction.reference);

    let data, status, txId;
    try {
      const raw = await lookupFn();
      data   = raw?.data || raw;
      status = data?.status;
      txId   = data?.transactionId || data?.id;
      console.log(`[Eversend Verify] ref=${reference} age=${Math.round(ageSeconds)}s status=${status}`);
    } catch (apiErr) {
      console.warn(`[Eversend Verify] API error (${apiErr.response?.status}):`, apiErr.response?.data?.message || apiErr.message);
      return res.status(200).json({ success: true, status: 'PENDING', message: 'Gateway temporarily unreachable. Please wait.' });
    }

    const s = (status || '').toUpperCase();
    if (s === 'SUCCESSFUL' || s === 'COMPLETED') {
      await settleTransaction(data, txId);
      return res.status(200).json({
        success: true,
        status: 'SUCCESSFUL',
        message: isSubscriptionTransaction(transaction) ? 'Subscription activated.' : 'Payment verified and wallet credited.',
        data: isSubscriptionTransaction(transaction) ? { subscription: true } : { balance_added: transaction.amount },
      });
    }
    if (s === 'FAILED') {
      transaction.status = 'failed';
      transaction.gateway_response = data;
      await transaction.save();
      return res.status(400).json({ success: false, status: 'FAILED', message: `Payment declined: ${data?.message || 'Declined'}`, reason: data?.message, reference });
    }

    return res.status(200).json({ success: true, status: 'PENDING', message: 'Still processing. Please wait.' });
  } catch (error) {
    console.error('Eversend Verify Error:', error.response?.data || error.message);
    return res.status(200).json({ success: true, status: 'PENDING', message: 'Verification temporarily unavailable. Please wait.' });
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

    // Look up by our internal reference OR by Eversend's transactionRef field
    const transaction = await Transaction.findOne({
      $or: [
        { reference },
        { gateway_transaction_id: reference },
      ],
      gateway: 'eversend',
    });

    if (!transaction) return res.status(404).json({ success: false, message: 'Transaction not found.' });

    // Already settled
    if (transaction.status === 'completed') {
      return res.status(200).json({ success: true, status: 'SUCCESSFUL', message: 'Payment has already been confirmed and your wallet was credited.', data: { balance_added: transaction.amount } });
    }

    // No gateway_transaction_id stored â€” try to find the transaction on Eversend
    // by the reference WE sent them (transactionRef). This handles the case where
    // Eversend collected the money but the webhook didn't fire (401 bug, now fixed).
    if (!transaction.gateway_transaction_id) {
      const isSandbox = transaction.metadata?.is_sandbox;
      if (isSandbox) {
        // Sandbox: auto-succeed
        if (transaction.status !== 'completed') {
          transaction.status = 'completed';
          await transaction.save();
          if (isSubscriptionTransaction(transaction)) {
            await settleSubscriptionTransaction(transaction, null, req.app);
          } else {
            await User.findByIdAndUpdate(transaction.user_id, { $inc: { wallet_balance: transaction.amount } });
          }
        }
        return res.status(200).json({
          success: true,
          status: 'SUCCESSFUL',
          message: isSubscriptionTransaction(transaction) ? 'Subscription activated.' : 'Sandbox payment confirmed.',
          data: isSubscriptionTransaction(transaction) ? { subscription: true } : { balance_added: transaction.amount },
        });
      }

      // Real transaction â€” ask Eversend by our reference
      let collectionData;
      try {
        const collRes = await eversend.getCollectionByRef(transaction.reference);
        collectionData = collRes?.data || collRes;
        console.log(`[Eversend Recheck] Lookup by ref=${transaction.reference}:`, JSON.stringify(collectionData)?.slice(0, 200));
      } catch (refErr) {
        const errStatus = refErr.response?.status;
        const errMsg = refErr.response?.data?.message || refErr.message;
        console.error(`[Eversend Recheck] getCollectionByRef failed (${errStatus}):`, errMsg);

        if ((errStatus === 401 || errStatus === 403) && (errMsg || '').toLowerCase().includes('origin')) {
          return res.status(503).json({ success: false, message: 'Payment gateway is only accessible from the production server. Please check from the live site.' });
        }
        if (errStatus === 404) {
          return res.status(200).json({ success: true, status: 'PENDING', message: 'Gateway has not recorded this transaction yet. If you approved the USSD prompt, please wait 1-2 minutes and try again.' });
        }
        return res.status(503).json({ success: false, message: 'Could not reach payment gateway. Please try again shortly.' });
      }

      // Parse status from the collection response
      const colStatus = (collectionData?.status || collectionData?.data?.status || '').toUpperCase();
      const colTxId   = collectionData?.transactionId || collectionData?.id || collectionData?.data?.transactionId;
      console.log(`[Eversend Recheck] colStatus=${colStatus} colTxId=${colTxId}`);

      if (colStatus === 'SUCCESSFUL' || colStatus === 'COMPLETED') {
        if (transaction.status !== 'completed') {
          const session = await mongoose.startSession();
          session.startTransaction();
          try {
            transaction.status = 'completed';
            if (colTxId) transaction.gateway_transaction_id = colTxId;
            transaction.gateway_response = collectionData;
            await transaction.save({ session });

            const isCheckout = transaction.order_ids?.length > 0;
            if (isSubscriptionTransaction(transaction)) {
              await settleSubscriptionTransaction(transaction, session, req.app);
            } else if (isCheckout) {
              await settleOrdersInSession(transaction.user_id, transaction.order_ids, req.app, session, true, getWebUrl(req), 'eversend');
            } else {
              await User.findByIdAndUpdate(transaction.user_id, { $inc: { wallet_balance: transaction.amount } }, { session });
            }
            await session.commitTransaction();

            setImmediate(() => {
              sendNotification(req.app, transaction.user_id, {
                title: '?? Wallet Credited',
                message: `Your deposit of ${transaction.amount.toLocaleString()} XAF has been confirmed and added to your wallet.`,
                type: 'wallet_update',
                metadata: { link: '/wallet' },
              }).catch(console.error);
            });
          } catch (err) {
            await session.abortTransaction();
            throw err;
          } finally {
            session.endSession();
          }
        }
        return res.status(200).json({
          success: true,
          status: 'SUCCESSFUL',
          message: isSubscriptionTransaction(transaction) ? 'Subscription activated.' : 'Payment confirmed! Your wallet has been credited.',
          data: isSubscriptionTransaction(transaction) ? { subscription: true } : { balance_added: transaction.amount },
        });
      }

      if (colStatus === 'FAILED' || colStatus === 'failed') {
        transaction.status = 'failed';
        transaction.gateway_response = collectionData;
        await transaction.save();
        return res.status(400).json({ success: false, status: 'FAILED', message: 'Payment was declined by the gateway.', reason: collectionData?.message || 'Declined' });
      }

      // PENDING or unknown â€” don't auto-fail, keep waiting
      return res.status(200).json({ success: true, status: 'PENDING', message: 'Payment is still being processed. Please check back in a moment.' });
    }

    let txStatus;
    let result;

    const isSandbox = transaction.metadata?.is_sandbox || (transaction.gateway_transaction_id?.startsWith('SBX-'));
    if (isSandbox) {
      txStatus = 'SUCCESSFUL';
      result = { data: { status: 'SUCCESSFUL' } };
    } else {
      try {
        result = await eversend.getTransactionStatus(transaction.gateway_transaction_id);
        txStatus = (result?.data?.status || result?.status || '').toUpperCase(); // normalize: Eversend returns lowercase
        console.log(`[Eversend Recheck] ref=${reference} gatewayId=${transaction.gateway_transaction_id} status=${txStatus}`);
      } catch (apiErr) {
        const errStatus = apiErr.response?.status;
        const errData = apiErr.response?.data;
        console.error(`[Eversend Recheck] Gateway API error (${errStatus}):`, errData || apiErr.message);

        // 404 from Eversend = transaction ID not found on their end
        if (errStatus === 404) {
          return res.status(200).json({ success: true, status: 'PENDING', message: 'Gateway has not recorded this transaction yet. If you approved the USSD prompt, check back in 1-2 minutes.' });
        }

        // Auth errors â€” check if it's an IP whitelist rejection vs real auth failure
        if (errStatus === 401 || errStatus === 403) {
          const ipBlocked = (apiErr.response?.data?.message || '').toLowerCase().includes('origin');
          if (ipBlocked) {
            console.error('[Eversend Recheck] IP not whitelisted â€” must call from production server (13.61.104.192)');
            return res.status(503).json({ success: false, message: 'Payment gateway is only accessible from the production server. Please check from the live site.' });
          }
          return res.status(500).json({ success: false, message: 'Payment gateway authentication failed. Please contact support.' });
        }

        return res.status(503).json({ success: false, message: 'Could not reach payment gateway. Please try again in a moment.' });
      }
    }

    if (txStatus === 'SUCCESSFUL') {
      if (transaction.status !== 'completed') {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
          transaction.status = 'completed';
          transaction.gateway_response = result.data;
          await transaction.save({ session });

          const isCheckout = transaction.order_ids?.length > 0;
          if (isSubscriptionTransaction(transaction)) {
            await settleSubscriptionTransaction(transaction, session, req.app);
          } else if (isCheckout) {
            await settleOrdersInSession(transaction.user_id, transaction.order_ids, req.app, session, true, getWebUrl(req), 'eversend');
          } else {
            await User.findByIdAndUpdate(transaction.user_id, { $inc: { wallet_balance: transaction.amount } }, { session });
          }

          await session.commitTransaction();

          // Notify user
          setImmediate(() => {
            sendNotification(req.app, transaction.user_id, {
              title: '?? Wallet Credited',
              message: `Your deposit of ${transaction.amount.toLocaleString()} XAF has been confirmed and added to your wallet.`,
              type: 'wallet_update',
              metadata: { link: '/wallet' },
            }).catch(console.error);
          });

        } catch (err) {
          await session.abortTransaction();
          throw err;
        } finally {
          session.endSession();
        }
      }
      return res.status(200).json({
        success: true,
        status: 'SUCCESSFUL',
        message: isSubscriptionTransaction(transaction) ? 'Subscription activated.' : 'Payment confirmed! Your wallet has been credited.',
        data: isSubscriptionTransaction(transaction) ? { subscription: true } : { balance_added: transaction.amount },
      });
    }

    if (txStatus === 'FAILED') {
      const reason = result?.data?.message || result?.message || 'Payment was declined by the gateway.';
      transaction.status = 'failed';
      transaction.gateway_response = result?.data || result;
      await transaction.save();
      return res.status(400).json({ success: false, status: 'FAILED', message: `Payment failed: ${reason}`, reason });
    }

    // Still PENDING
    return res.status(200).json({ success: true, status: 'PENDING', message: 'Payment is still being processed by the gateway. This usually takes 30-90 seconds.' });

  } catch (error) {
    console.error('Eversend Recheck Error:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Failed to recheck payment status. Please try again.' });
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
    if (!isValid) {
      console.warn('[Eversend Webhook] Invalid signature â€” rejecting');
      return res.status(401).send('Unauthorized');
    }

    // Body-parser may have already parsed this as an object, or it may be a raw string/Buffer
    let event;
    if (typeof req.body === 'string') {
      event = JSON.parse(req.body);
    } else if (Buffer.isBuffer(req.body)) {
      event = JSON.parse(req.body.toString('utf8'));
    } else {
      event = req.body; // already parsed by body-parser
    }

    const { type, data } = event;
    console.log(`[Eversend Webhook] type=${type} ref=${data?.transactionRef} id=${data?.transactionId}`);

    if (type === 'transaction.success' || type === 'collection.success') {
      const transaction = await Transaction.findOne({
        $or: [{ reference: data?.transactionRef }, { gateway_transaction_id: data?.transactionId }],
        gateway: 'eversend',
      });
      if (transaction && (transaction.status === 'pending' || transaction.status === 'failed')) {
        transaction.status = 'completed';
        transaction.gateway_response = data;
        await transaction.save();

        const isCheckout = transaction.order_ids?.length > 0;
        const isSubscription = isSubscriptionTransaction(transaction);
        if (isSubscription) {
          const session = await mongoose.startSession();
          session.startTransaction();
          try {
            await settleSubscriptionTransaction(transaction, session, req.app);
            await session.commitTransaction();
          } catch (err) {
            await session.abortTransaction();
            console.error('Webhook Subscription Settlement Error:', err.message);
          } finally { session.endSession(); }
        } else if (isCheckout) {
          const session = await mongoose.startSession();
          session.startTransaction();
          try {
            await settleOrdersInSession(transaction.user_id, transaction.order_ids, req.app, session, true, '', 'eversend');
            await session.commitTransaction();
          } catch (err) {
            await session.abortTransaction();
            console.error('Webhook Settlement Error:', err.message);
          } finally { session.endSession(); }
        } else {
          // Pure wallet top-up
          await User.findByIdAndUpdate(transaction.user_id, { $inc: { wallet_balance: transaction.amount } });
        }

        // -- Instant Socket.io push ? frontend shows success immediately --
        const io = req.app.get('io');
        if (io) {
          io.to(transaction.user_id.toString()).emit('wallet:credited', {
            amount: transaction.amount,
            reference: transaction.reference,
            type: isSubscription ? 'subscription' : (isCheckout ? 'checkout' : 'deposit'),
          });
        }

        // In-app notification
        setImmediate(() => {
          sendNotification(req.app, transaction.user_id, {
            title: '?? Payment Confirmed',
            message: `Your ${isSubscription ? 'subscription' : (isCheckout ? 'order' : 'deposit')} of ${transaction.amount.toLocaleString()} XAF has been confirmed.`,
            type: 'wallet_update',
            metadata: { link: isSubscription ? '/subscribe' : (isCheckout ? '/orders' : '/wallet') },
          }).catch(console.error);
          // Admin email for pure wallet top-ups only (checkout orders are notified in settle.service.js)
          if (!isSubscription && !isCheckout) {
            notifyAdmins(req.app, {
              title: 'New Wallet Deposit',
              message: `${transaction.amount.toLocaleString()} XAF deposited via Eversend (ref: ${transaction.reference}).`,
              type: 'system_alert',
              metadata: { link: '/admin/transactions' },
              sendEmail: true,
            }).catch(console.error);
          }
        });

        console.log(`? Eversend: ${isSubscription ? 'subscription activated' : (isCheckout ? 'orders settled' : 'wallet credited')} ${transaction.amount} XAF for user ${transaction.user_id}`);
      }
    }

    if (type === 'transaction.failed' || type === 'collection.failed' || type === 'payout.failed') {
      const transaction = await Transaction.findOneAndUpdate(
        { reference: data?.transactionRef, gateway: 'eversend' },
        { status: 'failed', gateway_response: data },
        { returnDocument: 'after' }
      );
      if (transaction?.order_ids?.length) {
        await markCheckoutOrdersFailed(transaction.user_id, transaction.order_ids);
      }
      // If it was a payout, we might want to alert the admin or notify the vendor
      if (type === 'payout.failed') {
        console.error(`? Eversend Payout Failed: ${data?.transactionRef}`, data?.message);
        // TODO: Trigger admin alert/email
      }
    }

    if (type === 'payout.success') {
      const transaction = await Transaction.findOneAndUpdate(
        { reference: data?.transactionRef, gateway: 'eversend' },
        { status: 'completed', gateway_response: data },
        { returnDocument: 'after' }
      );
      if (transaction) {
        console.log(`? Eversend Payout Success: ${data?.transactionRef} to user ${transaction.user_id}`);
        // Push instant socket notification
        const io = req.app.get('io');
        if (io) io.to(transaction.user_id.toString()).emit('withdrawal:paid', { amount: transaction.amount, reference: transaction.reference });
        setImmediate(() => {
          sendNotification(req.app, transaction.user_id, {
            title: '? Withdrawal Sent',
            message: `Your withdrawal of ${transaction.amount.toLocaleString()} XAF has been processed successfully.`,
            type: 'wallet_update',
            metadata: { link: '/wallet' },
            sendEmail: true,
          }).catch(console.error);
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
 * @route   POST /api/payments/eversend/recover/:reference
 * @desc    Admin: Manually recover a payment the gateway confirmed but our DB marked as failed/pending.
 *          Use this for transactions like AURA-1779123970906-6a0b454d300557850d5da752 where Eversend
 *          received funds (gateway_response = Success) but our webhook was missed or auto-fail ran early.
 * @access  Private (admin only)
 * @body    { force?: boolean }  â€” if true, skip live gateway check and credit directly
 */
const eversendRecover = async (req, res) => {
  try {
    const { reference } = req.params;
    const { force = false } = req.body;

    const transaction = await Transaction.findOne({
      $or: [
        { reference },
        { gateway_transaction_id: reference },
      ],
      gateway: 'eversend',
    });

    if (!transaction) {
      return res.status(404).json({ success: false, message: `No Eversend transaction found for reference: ${reference}` });
    }

    if (transaction.status === 'completed') {
      return res.status(200).json({ success: true, message: 'Transaction already completed â€” wallet was already credited.', data: { transaction } });
    }

    let shouldCredit = false;
    let resolvedStatus = null;

    if (force) {
      // Admin-forced recovery â€” trust the gateway receipt provided by the user
      shouldCredit = true;
      resolvedStatus = 'force-recovered';
      console.warn(`[eversendRecover] FORCE recovery by admin ${req.user._id} for ref=${reference}`);
    } else {
      // Try live gateway check first
      if (transaction.gateway_transaction_id && !transaction.gateway_transaction_id.startsWith('SBX-')) {
        try {
          const result = await eversend.getTransactionStatus(transaction.gateway_transaction_id);
          const txStatus = result?.data?.status || result?.status;
          console.log(`[eversendRecover] Live status for ${transaction.gateway_transaction_id}:`, txStatus);

          if (txStatus === 'SUCCESSFUL') {
            shouldCredit = true;
            resolvedStatus = 'gateway-confirmed';
          } else if (txStatus === 'FAILED') {
            return res.status(400).json({ success: false, message: `Gateway confirms this transaction is FAILED. Use force=true to override if you have proof of payment.`, status: txStatus });
          } else {
            return res.status(400).json({ success: false, message: `Gateway status is still ${txStatus || 'UNKNOWN'}. Use force=true if you have confirmed receipt from the gateway dashboard.`, status: txStatus });
          }
        } catch (checkErr) {
          console.warn('[eversendRecover] Could not reach gateway for live check:', checkErr.message);
          return res.status(400).json({ success: false, message: `Could not verify with gateway: ${checkErr.message}. Use force=true if you have confirmed receipt.` });
        }
      } else {
        return res.status(400).json({ success: false, message: 'No gateway_transaction_id on this transaction. Use force=true to recover based on manual gateway confirmation.' });
      }
    }

    if (!shouldCredit) {
      return res.status(400).json({ success: false, message: 'Recovery conditions not met.' });
    }

    // Recover the appropriate financial action
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      transaction.status = 'completed';
      transaction.gateway_response = {
        ...(transaction.gateway_response || {}),
        recovered_by: req.user._id,
        recovered_at: new Date(),
        recovery_method: resolvedStatus,
      };
      await transaction.save({ session });

      const isCheckout = transaction.order_ids?.length > 0;
      if (isSubscriptionTransaction(transaction)) {
        await settleSubscriptionTransaction(transaction, session, req.app);
      } else if (isCheckout) {
        await settleOrders(transaction.user_id, transaction.order_ids, session, req.app, true, getWebUrl(req), 'eversend');
      } else {
        await User.findByIdAndUpdate(transaction.user_id, { $inc: { wallet_balance: transaction.amount } }, { session });
      }

      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }

    // Notify the user
    setImmediate(() => {
      sendNotification(req.app, transaction.user_id, {
        title: '?? Wallet Credited',
        message: `Your deposit of ${transaction.amount.toLocaleString()} XAF has been confirmed and added to your wallet. (Ref: ${transaction.reference})`,
        type: 'wallet_update',
        metadata: { link: '/wallet' },
        sendEmail: true,
      }).catch(console.error);
    });

    const updatedUser = await User.findById(transaction.user_id).select('wallet_balance name email');
    console.log(`? [eversendRecover] Successfully recovered ${transaction.amount} XAF for user ${transaction.user_id}. New balance: ${updatedUser?.wallet_balance}`);

    return res.status(200).json({
      success: true,
      message: `? Transaction recovered. ${transaction.amount.toLocaleString()} XAF credited to user's wallet.`,
      data: {
        transaction,
        user: { name: updatedUser?.name, email: updatedUser?.email, new_balance: updatedUser?.wallet_balance },
        recovery_method: resolvedStatus,
      },
    });
  } catch (error) {
    console.error('[eversendRecover] Error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
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

// -----------------------------------------------------------------------------
module.exports = {
  // Gateway registry endpoint
  listGateways,
  failCheckoutPayment,
  payunitInitialize,
  payunitVerify,
  payunitRecheck: payunitVerify,
  payunitWebhook,
  // Paystack
  initializePayment,
  verifyPayment,
  handleWebhook,
  // Eversend
  eversendGetWallets,
  eversendInitialize,
  eversendVerify,
  eversendRecheck,
  eversendRecover,
  eversendWebhook,
  eversendGetBeneficiaries,
  eversendCreateBeneficiary,
  eversendDeleteBeneficiary,
  eversendGetTransactions,
  eversendPayoutBeneficiary,
  // Internal / admin sync
  settleOrdersInSession,
};
