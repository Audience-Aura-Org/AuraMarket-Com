/**
 * controllers/p2p.controller.js
 * Auradime — P2P Pickup & Delivery Controller
 */

const mongoose = require('mongoose');
const crypto = require('crypto');
const Shipment = require('../models/Shipment.model');
const User = require('../models/User.model');
const Transaction = require('../models/Transaction.model');
const PlatformSettings = require('../models/PlatformSettings.model');
const { generateTrackingCode } = require('../services/logistics.service');
const { getQuotes, getQuoteForProvider } = require('../services/p2p.service');
const LogisticsCompany = require('../models/LogisticsCompany.model');
const { debitBalance, creditBalance } = require('../services/wallet.service');
const { sendNotification } = require('../utils/notifier');
const { sendEmail } = require('../utils/emailService');

const JWT_SECRET = process.env.JWT_SECRET;

// ── Helpers ────────────────────────────────────────────────────────────

const hashOtp = (otp) =>
  crypto.createHmac('sha256', JWT_SECRET).update(String(otp)).digest('hex');

const genRef = (prefix) => `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

// ── GET QUOTE ──────────────────────────────────────────────────────────

const getP2PQuote = async (req, res) => {
  try {
    const { pickup_zone_id, dropoff_zone_id, weight_tier } = req.body;

    if (!pickup_zone_id || !dropoff_zone_id) {
      return res.status(400).json({ success: false, message: 'pickup_zone_id and dropoff_zone_id are required' });
    }

    const result = await getQuotes({
      pickup_zone_id,
      dropoff_zone_id,
      weight_tier: weight_tier || 'light',
    });

    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('[p2p] getP2PQuote error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to get quote' });
  }
};

// ── CREATE P2P SHIPMENT ────────────────────────────────────────────────

const createP2PShipment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const settings = await PlatformSettings.getSettings(session);

    if (!settings.p2p_enabled) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'P2P delivery is not currently available' });
    }

    const {
      direction,
      pickup_address,
      dropoff_address,
      package_details,
      other_party,
      scheduled_pickup,
      payment_method,
      guest_session_id,
      provider_id,
    } = req.body;

    // Validate provider selection
    if (!provider_id) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'provider_id is required — select a delivery provider' });
    }

    // Validate direction
    if (!['send', 'request_pickup'].includes(direction)) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'direction must be "send" or "request_pickup"' });
    }

    // Validate prohibited items confirmation
    if (!package_details?.prohibited_items_confirmed) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'You must confirm no prohibited items are included' });
    }

    // KYC check for high-value packages
    const declaredValue = package_details?.declared_value || 0;
    if (declaredValue > settings.p2p_kyc_threshold) {
      if (!req.user) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: 'Account with KYC verification required for high-value packages' });
      }
      if (req.user.verification_status !== 'verified') {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: 'KYC verification required for packages above ' + settings.p2p_kyc_threshold + ' XAF' });
      }
    }

    // Validate provider is enabled and get quote for this specific provider
    const quote = await getQuoteForProvider({
      provider_id,
      pickup_zone_id: pickup_address?.zone_id,
      dropoff_zone_id: dropoff_address?.zone_id,
      weight_tier: package_details?.weight_tier || 'light',
    });

    if (!quote.coverage) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: quote.reason || 'No coverage for this route' });
    }

    // Fetch provider doc for shipment reference
    const provider = await LogisticsCompany.findById(provider_id).lean();
    if (!provider) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Selected delivery provider not found' });
    }

    const trackingCode = await generateTrackingCode();

    // Build shipment data
    const shipmentData = {
      type: 'p2p',
      direction,
      logistics_id: provider._id,
      tracking_code: trackingCode,
      status: 'pending',
      price: quote.price,
      pickup_address: {
        street: pickup_address.street,
        city: pickup_address.city,
        region: pickup_address.region,
        quartier: pickup_address.quartier,
        phone: pickup_address.phone,
        zone_id: pickup_address.zone_id || null,
      },
      delivery_address: {
        street: dropoff_address.street,
        city: dropoff_address.city,
        region: dropoff_address.region,
        quartier: dropoff_address.quartier,
        phone: dropoff_address.phone,
        zone_id: dropoff_address.zone_id || null,
      },
      delivery_description: pickup_address.landmark_description || dropoff_address.landmark_description || null,
      package_details: {
        category: package_details.category,
        weight_tier: package_details.weight_tier || 'light',
        declared_value: declaredValue,
        description: package_details.description,
        prohibited_items_confirmed: true,
      },
      scheduled_pickup: scheduled_pickup || null,
      shipment_logs: [{
        status: 'pending',
        updated_by: req.user?._id || null,
        note: 'P2P shipment created',
      }],
    };

    // Set other party
    if (other_party) {
      shipmentData.other_party = {
        user_id: other_party.user_id || null,
        name: other_party.name,
        phone: other_party.phone,
        email: other_party.email,
        address: other_party.address || null,
      };
    }

    // Set booker identity
    if (req.user) {
      shipmentData.booked_by = req.user._id;
      shipmentData.paid_by = req.user._id;
    } else {
      shipmentData.guest_booker = {
        name: req.body.booker_name,
        phone: req.body.booker_phone,
        email: req.body.booker_email,
        guest_session_id: guest_session_id,
      };
    }

    // Process payment
    if (payment_method === 'wallet' && req.user) {
      // Wallet debit
      const debited = await debitBalance(req.user._id, quote.price, session);
      if (!debited) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });
      }

      // Create payment transaction
      await Transaction.create([{
        user_id: req.user._id,
        type: 'payment',
        amount: quote.price,
        reference: genRef('P2P-PAY'),
        status: 'completed',
        description: `P2P delivery payment — ${trackingCode}`,
        gateway: 'wallet',
        metadata: { tracking_code: trackingCode, type: 'p2p' },
      }], { session });

      shipmentData.payment_status = 'paid';
      shipmentData.payment_reference = genRef('P2P-PAY');

      // Pre-commit platform fee
      if (quote.platform_fee > 0) {
        settings.platform_wallet_balance = (settings.platform_wallet_balance || 0) + quote.platform_fee;
        await settings.save({ session });
      }
    } else {
      // Gateway payment — shipment created as unpaid, payment handled via webhook
      shipmentData.payment_status = 'pending';
    }

    const [shipment] = await Shipment.create([shipmentData], { session });
    await session.commitTransaction();

    // Non-blocking notifications
    setImmediate(async () => {
      try {
        if (req.user) {
          await sendNotification(req.app, req.user._id, {
            title: 'Delivery Booked',
            message: `Your delivery ${trackingCode} has been booked. We'll notify you when a rider is assigned.`,
            type: 'p2p_status',
            metadata: { target_id: shipment._id, tracking_code: trackingCode, link: `/delivery/track?code=${trackingCode}` },
          });
        }
        // Notify other party if they have an account
        if (other_party?.user_id) {
          await sendNotification(req.app, other_party.user_id, {
            title: direction === 'send' ? 'Package Coming Your Way' : 'Pickup Requested',
            message: `A delivery (${trackingCode}) has been booked. Track it in your deliveries.`,
            type: 'p2p_status',
            metadata: { target_id: shipment._id, tracking_code: trackingCode, link: `/delivery/track?code=${trackingCode}` },
          });
        }
        // Email guest other party
        if (other_party?.email && !other_party?.user_id) {
          await sendEmail({
            to: other_party.email,
            subject: `Delivery ${trackingCode} — ${direction === 'send' ? 'Package on the way' : 'Pickup requested'}`,
            html: `<p>A delivery has been booked for you on Auradime.</p><p>Tracking code: <strong>${trackingCode}</strong></p><p>Track your delivery at: <a href="https://auradime.com/delivery/track?code=${trackingCode}">auradime.com/delivery/track</a></p>`,
          });
        }
      } catch (notifyErr) {
        console.error('[p2p] notification error:', notifyErr.message);
      }
    });

    return res.status(201).json({
      success: true,
      message: 'P2P shipment created',
      data: {
        shipment: {
          _id: shipment._id,
          tracking_code: shipment.tracking_code,
          status: shipment.status,
          price: shipment.price,
          payment_status: shipment.payment_status,
          direction: shipment.direction,
        },
      },
    });
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    console.error('[p2p] createP2PShipment error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to create shipment' });
  } finally {
    session.endSession();
  }
};

// ── MY DELIVERIES ──────────────────────────────────────────────────────

const getMyDeliveries = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = {
      type: 'p2p',
      $or: [
        { booked_by: userId },
        { 'other_party.user_id': userId },
      ],
    };
    if (status) filter.status = status;

    const [shipments, total] = await Promise.all([
      Shipment.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('tracking_code status direction price payment_status pickup_address.city delivery_address.city package_details.category booked_by other_party.user_id createdAt')
        .lean(),
      Shipment.countDocuments(filter),
    ]);

    // Annotate with role (sent/received)
    const annotated = shipments.map(s => ({
      ...s,
      role: s.booked_by?.toString() === userId.toString() ? 'booker' : 'recipient',
    }));

    return res.json({
      success: true,
      data: { shipments: annotated },
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (err) {
    console.error('[p2p] getMyDeliveries error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch deliveries' });
  }
};

// ── GUEST DELIVERIES ───────────────────────────────────────────────────

const getGuestDeliveries = async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'Session ID required' });
    }

    const shipments = await Shipment.find({
      type: 'p2p',
      'guest_booker.guest_session_id': sessionId,
    })
      .sort({ createdAt: -1 })
      .select('tracking_code status direction price payment_status pickup_address.city delivery_address.city package_details.category createdAt')
      .lean();

    return res.json({ success: true, data: { shipments } });
  } catch (err) {
    console.error('[p2p] getGuestDeliveries error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch deliveries' });
  }
};

// ── TRACK SHIPMENT ─────────────────────────────────────────────────────

const trackP2PShipment = async (req, res) => {
  try {
    const { trackingCode } = req.params;
    const shipment = await Shipment.findOne({
      tracking_code: trackingCode.toUpperCase(),
      type: 'p2p',
    })
      .select('tracking_code status direction price payment_status pickup_address delivery_address package_details shipment_logs proof_of_delivery estimated_delivery createdAt')
      .lean();

    if (!shipment) {
      return res.status(404).json({ success: false, message: 'Shipment not found' });
    }

    return res.json({ success: true, data: { shipment } });
  } catch (err) {
    console.error('[p2p] trackP2PShipment error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to track shipment' });
  }
};

// ── CANCEL P2P SHIPMENT ────────────────────────────────────────────────

const cancelP2PShipment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const shipment = await Shipment.findOne({
      _id: req.params.id,
      type: 'p2p',
    }).session(session);

    if (!shipment) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Shipment not found' });
    }

    // Verify ownership
    const isOwner = req.user
      ? shipment.booked_by?.toString() === req.user._id.toString()
      : shipment.guest_booker?.guest_session_id === req.body.guest_session_id;

    if (!isOwner && req.user?.role !== 'admin') {
      await session.abortTransaction();
      return res.status(403).json({ success: false, message: 'Not authorized to cancel this shipment' });
    }

    if (['delivered', 'cancelled'].includes(shipment.status)) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: `Cannot cancel a ${shipment.status} shipment` });
    }

    const settings = await PlatformSettings.getSettings(session);

    // Free cancellation before dispatch, fee after
    let cancellationFee = 0;
    if (['assigned', 'picked_up', 'in_transit', 'out_for_delivery'].includes(shipment.status)) {
      cancellationFee = settings.p2p_cancellation_fee || 0;
    }

    const refundAmount = shipment.price - cancellationFee;

    // Refund to booker if paid
    if (shipment.payment_status === 'paid' && refundAmount > 0 && shipment.paid_by) {
      await creditBalance(shipment.paid_by, refundAmount, session);
      await Transaction.create([{
        user_id: shipment.paid_by,
        type: 'refund',
        amount: refundAmount,
        reference: genRef('P2P-REFUND'),
        status: 'completed',
        description: `P2P delivery cancelled — ${shipment.tracking_code}${cancellationFee > 0 ? ` (fee: ${cancellationFee} XAF)` : ''}`,
        gateway: 'wallet',
        metadata: { tracking_code: shipment.tracking_code, cancellation_fee: cancellationFee },
      }], { session });
    }

    shipment.status = 'cancelled';
    shipment.payment_status = refundAmount > 0 ? 'refunded' : shipment.payment_status;
    shipment.cancellation_fee = cancellationFee;
    shipment.shipment_logs.push({
      status: 'cancelled',
      updated_by: req.user?._id || null,
      note: cancellationFee > 0 ? `Cancelled after dispatch (fee: ${cancellationFee} XAF)` : 'Cancelled before dispatch',
    });

    await shipment.save({ session });
    await session.commitTransaction();

    return res.json({
      success: true,
      message: 'Shipment cancelled',
      data: {
        refund_amount: refundAmount,
        cancellation_fee: cancellationFee,
      },
    });
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    console.error('[p2p] cancelP2PShipment error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to cancel shipment' });
  } finally {
    session.endSession();
  }
};

// ── POD OTP — SEND ─────────────────────────────────────────────────────

const sendPodOtp = async (req, res) => {
  try {
    const shipment = await Shipment.findOne({
      _id: req.params.id,
      type: 'p2p',
      status: 'out_for_delivery',
    });

    if (!shipment) {
      return res.status(404).json({ success: false, message: 'Shipment not found or not out for delivery' });
    }

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    shipment.pod_otp_hash = hashOtp(otp);
    shipment.pod_otp_expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    shipment.pod_otp_attempts = 0;
    await shipment.save();

    // Send OTP via email to recipient
    const recipientEmail = shipment.other_party?.email || shipment.delivery_address?.phone;
    if (shipment.other_party?.email) {
      await sendEmail({
        to: shipment.other_party.email,
        subject: `Delivery OTP — ${shipment.tracking_code}`,
        html: `<p>Your delivery confirmation code is: <strong style="font-size:24px;letter-spacing:4px">${otp}</strong></p><p>Share this code with the rider to confirm delivery.</p><p>This code expires in 10 minutes.</p>`,
      });
    }

    // Notify recipient via app if they have an account
    if (shipment.other_party?.user_id) {
      await sendNotification(req.app, shipment.other_party.user_id, {
        title: 'Delivery Arriving — Confirm with OTP',
        message: `Your delivery ${shipment.tracking_code} is here. Check your email for the confirmation code.`,
        type: 'p2p_delivery',
        metadata: { target_id: shipment._id, tracking_code: shipment.tracking_code },
      });
    }

    return res.json({ success: true, message: 'Delivery OTP sent to recipient' });
  } catch (err) {
    console.error('[p2p] sendPodOtp error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to send OTP' });
  }
};

// ── POD OTP — VERIFY ───────────────────────────────────────────────────

const verifyPodOtp = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { otp } = req.body;
    if (!otp || !/^\d{6}$/.test(otp)) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Valid 6-digit OTP required' });
    }

    const shipment = await Shipment.findOne({
      _id: req.params.id,
      type: 'p2p',
      status: 'out_for_delivery',
    }).session(session);

    if (!shipment) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Shipment not found or not out for delivery' });
    }

    // Check attempts
    if (shipment.pod_otp_attempts >= 3) {
      await session.abortTransaction();
      return res.status(429).json({ success: false, message: 'Too many attempts. Request a new OTP.' });
    }

    // Check expiry
    if (!shipment.pod_otp_expires || shipment.pod_otp_expires < new Date()) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'OTP expired. Request a new one.' });
    }

    // Verify OTP
    const inputHash = hashOtp(otp);
    const isValid = crypto.timingSafeEqual(
      Buffer.from(inputHash, 'hex'),
      Buffer.from(shipment.pod_otp_hash, 'hex')
    );

    if (!isValid) {
      shipment.pod_otp_attempts += 1;
      await shipment.save({ session });
      await session.commitTransaction();
      return res.status(400).json({ success: false, message: 'Invalid OTP', attempts_remaining: 3 - shipment.pod_otp_attempts });
    }

    // OTP valid — mark as delivered
    shipment.status = 'delivered';
    shipment.proof_of_delivery = {
      note: 'Confirmed via OTP',
      receiver_name: shipment.other_party?.name || 'Recipient',
      timestamp: new Date(),
    };
    shipment.pod_otp_hash = undefined;
    shipment.pod_otp_expires = undefined;
    shipment.pod_otp_attempts = 0;
    shipment.shipment_logs.push({
      status: 'delivered',
      updated_by: req.user?._id || null,
      note: 'Delivery confirmed via OTP',
    });

    // Credit logistics firm
    const LogisticsCompany = require('../models/LogisticsCompany.model');
    const firm = await LogisticsCompany.findById(shipment.logistics_id).select('user_id').lean();
    if (firm) {
      const settings = await PlatformSettings.getSettings(session);
      const platformFee = Math.round(shipment.price * (settings.p2p_commission_percent || 0) / 100);
      const firmPayout = shipment.price - platformFee;

      if (firmPayout > 0) {
        await creditBalance(firm.user_id, firmPayout, session);
        await Transaction.create([{
          user_id: firm.user_id,
          type: 'payout',
          amount: firmPayout,
          reference: genRef('P2P-PAYOUT'),
          status: 'completed',
          description: `P2P delivery payout — ${shipment.tracking_code}`,
          gateway: 'wallet',
          metadata: { tracking_code: shipment.tracking_code },
        }], { session });
      }
    }

    await shipment.save({ session });
    await session.commitTransaction();

    // Non-blocking notifications
    setImmediate(async () => {
      try {
        if (shipment.booked_by) {
          await sendNotification(req.app, shipment.booked_by, {
            title: 'Delivery Confirmed',
            message: `Your delivery ${shipment.tracking_code} has been successfully delivered.`,
            type: 'p2p_delivery',
            metadata: { target_id: shipment._id, tracking_code: shipment.tracking_code },
          });
        }
        if (shipment.other_party?.user_id) {
          await sendNotification(req.app, shipment.other_party.user_id, {
            title: 'Delivery Received',
            message: `Delivery ${shipment.tracking_code} confirmed. Thank you!`,
            type: 'p2p_delivery',
            metadata: { target_id: shipment._id, tracking_code: shipment.tracking_code },
          });
        }
      } catch (notifyErr) {
        console.error('[p2p] verifyPodOtp notification error:', notifyErr.message);
      }
    });

    return res.json({ success: true, message: 'Delivery confirmed' });
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    console.error('[p2p] verifyPodOtp error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to verify OTP' });
  } finally {
    session.endSession();
  }
};

// ── USER LOOKUP ────────────────────────────────────────────────────────

const lookupUser = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 3) {
      return res.json({ success: true, data: { found: false } });
    }

    const query = q.trim().toLowerCase();

    // Search by username, phone, or email (case-insensitive)
    const Vendor = require('../models/Vendor.model');

    const user = await User.findOne({
      is_active: true,
      $or: [
        { username: { $regex: `^${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
        { phone: { $regex: `${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
        { email: { $regex: `^${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
      ],
    })
      .select('name username avatar branding phone email role onboarding_location addresses')
      .lean();

    if (!user) {
      // Non-enumerating: always 200
      return res.json({ success: true, data: { found: false } });
    }

    // Build display name (first name + initial of last)
    const nameParts = user.name.split(' ');
    const displayName = nameParts.length > 1
      ? `${nameParts[0]} ${nameParts[1][0]}.`
      : nameParts[0];

    // Resolve address: saved addresses → vendor pickup_address → onboarding_location
    const defaultAddr = (user.addresses || []).find(a => a.isDefault) || (user.addresses || [])[0] || null;
    const loc = user.onboarding_location || {};

    // Check vendor store pickup_address as another fallback
    const vendor = await Vendor.findOne({ user_id: user._id }).select('pickup_address').lean();
    const vendorAddr = vendor?.pickup_address || null;

    // Resolve avatar: branding.logo → avatar → store logo
    let resolvedAvatar = user.branding?.logo || user.avatar || null;
    if (!resolvedAvatar && vendor) {
      const Store = require('../models/Store.model');
      const store = await Store.findOne({ vendor_id: vendor._id }).select('logo').lean();
      if (store?.logo) resolvedAvatar = store.logo;
    }

    return res.json({
      success: true,
      data: {
        found: true,
        user: {
          _id: user._id,
          name: displayName,
          username: user.username,
          avatar: resolvedAvatar,
          phone: user.phone || '',
          email: user.email || '',
          address: {
            street: defaultAddr?.street || vendorAddr?.address_description || vendorAddr?.street || loc.address_description || '',
            city: defaultAddr?.city || vendorAddr?.city || loc.city || '',
            district: defaultAddr?.region || vendorAddr?.district || loc.zone || '',
            quartier: defaultAddr?.quartier || vendorAddr?.quartier || loc.quartier || '',
            zone_id: defaultAddr?.zone_id || vendorAddr?.zone_id || '',
          },
        },
      },
    });
  } catch (err) {
    console.error('[p2p] lookupUser error:', err.message);
    return res.status(500).json({ success: false, message: 'Lookup failed' });
  }
};

module.exports = {
  getP2PQuote,
  createP2PShipment,
  getMyDeliveries,
  getGuestDeliveries,
  trackP2PShipment,
  cancelP2PShipment,
  sendPodOtp,
  verifyPodOtp,
  lookupUser,
};
