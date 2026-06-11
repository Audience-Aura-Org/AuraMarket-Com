const webPush = require('web-push');
const Notification = require('../models/Notification.model');
const User = require('../models/User.model');
const { 
  VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, EMAIL_USER 
} = require('../config/env');
const { sendEmail: dispatchEmail } = require('./emailService');
const { enqueueJob } = require('../services/jobQueue.service');

// ── VAPID Keys Calibration ──────────────────────────────────────────────────
// These keys must match the ones in pwa-helper.js on the frontend
const VAPID_PUB  = VAPID_PUBLIC_KEY  || 'BPhRBNH4-gNAvZGDAELIrh-CS6_U4pAxfnVbLGnqjBBkekohWswpHk1leAH6It2wvc66fEo4IBunBrB-I6P5LPQ';
const VAPID_PRIV = VAPID_PRIVATE_KEY || 'aQU1zExyXuDZTuBlsHmI6iQwrVCvShRCGLR7GOYOSeY';

webPush.setVapidDetails('mailto:hello@auradime.com', VAPID_PUB, VAPID_PRIV);

// ── Signal Constants ─────────────────────────────────────────────────────────
const LOGO_URL = 'https://auradime.com/logo-white.png';
const WEB_PUSH_OPTIONS = {
  TTL: 60 * 60 * 24,
  urgency: 'high',
};

// App brand colors for notifier fallback
const COLORS = {
  accent: '#f20df2',
  accentLight: '#f472b6',
  accentGlow: 'rgba(242, 13, 242, 0.12)',
  bgPrimary: '#ffffff',
  bgSecondary: '#f8f5f8',
  textPrimary: '#0f172a',
  textSecondary: '#64748b',
};

const templates = require('./emailTemplates');

const NOTIFICATION_TRANSLATIONS = {
  fr: {
    'Funds Released': 'Fonds liberes',
    'Order placed': 'Commande passee',
    'Order updated': 'Commande mise a jour',
    'Order Completed': 'Commande terminee',
    'Order Paid & Confirmed': 'Commande payee et confirmee',
    'Order Payment Confirmed': 'Paiement de commande confirme',
    'New Shipment Assigned': 'Nouvelle expedition assignee',
    'New pickup request': 'Nouvelle demande de ramassage',
    'Order assigned': 'Commande assignee',
    'Delivery confirmed': 'Livraison confirmee',
    'Payment released': 'Paiement libere',
    'Dispute involving delivery': 'Litige lie a la livraison',
    'Withdrawal Request Submitted': 'Demande de retrait envoyee',
    'Withdrawal requested': 'Retrait demande',
    'Payout Failed': 'Paiement echoue',
    'Payout processed': 'Paiement traite',
    'Withdrawal Successful': 'Retrait reussi',
    'Withdrawal Approved — Processing': 'Retrait approuve — traitement en cours',
    'Withdrawal Request Rejected': 'Demande de retrait rejetee',
    'Withdrawal Failed': 'Retrait echoue',
    'Your order has been delivered': 'Votre commande a ete livree',
    'Shipment Successfully Closed': 'Expedition cloturee',
    'Order Completed — Payment Released': 'Commande terminee — paiement libere',
    'Escrow Auto-Released': 'Sequestre libere automatiquement',
    'Order Finalized': 'Commande finalisee',
    'Package Delivered': 'Colis livre',
    'Vendor Confirmed Delivery': 'Livraison confirmee par le vendeur',
    'New Escrow Dispute': 'Nouveau litige de sequestre',
    'Dispute Raised': 'Litige ouvert',
    'Dispute opened': 'Litige ouvert',
    'Dispute update': 'Mise a jour du litige',
    'Low Stock Alert': 'Alerte stock faible',
    'New Order Received': 'Nouvelle commande recue',
    'New Order Received (POD)': 'Nouvelle commande recue (paiement a la livraison)',
    'New Shipment Assigned (POD)': 'Nouvelle expedition assignee (paiement a la livraison)',
    'New Shipment Assigned (Bulk POD)': 'Nouvelles expeditions assignees (paiement a la livraison)',
    'Order Cancelled & Refunded': 'Commande annulee et remboursee',
    'Order Cancelled': 'Commande annulee',
    'Product Inventory Update': 'Mise a jour du stock produit',
    'Restock Alert!': 'Retour en stock !',
    'New Arrival Alert!': 'Nouvelle arrivee !',
    'Product Published': 'Produit publie',
    'Identity Verified': 'Identite verifiee',
    'KYC Rejected': 'KYC rejete',
    'KYC approved': 'KYC approuve',
    'KYC rejected': 'KYC rejete',
    'Shipment Assignment Updated': 'Assignation d’expedition mise a jour',
    'Shipment Coordination Update': 'Mise a jour coordination expedition',
    'Verification Required': 'Verification requise',
    'Wallet Credited': 'Wallet credite',
    'New Product Question': 'Nouvelle question produit',
    'Question Answered': 'Question repondue',
    'New Status Reaction ❤️': 'Nouvelle reaction au statut ❤️',
    'All notifications marked as read': 'Toutes les notifications sont marquees comme lues',
  },
};

const translateNotificationText = (text, language = 'en') => {
  if (!text || language !== 'fr') return text;
  const direct = NOTIFICATION_TRANSLATIONS.fr[text];
  if (direct) return direct;
  return String(text)
    .replace(/^Shipment Update:/, 'Mise a jour expedition :')
    .replace(/^Order Updated:/, 'Commande mise a jour :')
    .replace(/^Withdrawal /, 'Retrait ');
};

/**
 * Signal Template: Standard Order/Status Email (Updated with app colors)
 * This now uses the shared premium templates to ensure consistency.
 */
const buildOrderEmailHtml = (title, message, orderDetails, role, emailLink, qrCode, webUrl) => {
  // If we have full order details, use the premium order template
  if (orderDetails) {
    if (role === 'customer' || role === 'user') {
      const templateData = templates.orderPlaced({ 
        order: orderDetails, 
        customer: { name: orderDetails.customer_name || 'Valued Customer' },
        qrCode: qrCode || orderDetails.qrCode,
        webUrl: webUrl
      });
      return templateData.html;
    }
    
    if (role === 'logistics') {
      const templateData = templates.shipmentAssigned({ 
        order: orderDetails,
        logistics: { company_name: 'Logistics Partner' }, // Generic label, notifier will fetch contact_email
        webUrl: webUrl
      });
      return templateData.html;
    }
 
    if (role === 'vendor') {
      const templateData = templates.newOrderForVendor({ 
        order: orderDetails,
        vendor: { store_name: orderDetails.vendor_name || 'Vendor' },
        webUrl: webUrl
      });
      return templateData.html;
    }
  }
 
  // Fallback to a styled generic notification using the shared wrapper
  return templates.wrap(title, title, `
    <p>${message}</p>
    ${emailLink ? `<div style="text-align: center; margin-top: 32px;"><a href="${emailLink}" class="btn">View Details</a></div>` : ''}
  `);
};
 
const sendNotification = async (app, recipientId, data) => {
  try {
    const { 
      title, 
      message, 
      type, 
      metadata, 
      sendEmail = false, 
      emailLink = null, 
      orderDetails = null, 
      role = 'user', 
      overrideEmail = null, 
      emailTemplate = null,
      qrCode = null,
      webUrl = null,
      senderAvatar = null,   // chat: sender's avatar for richer OS notification
    } = data;

    const recipientProfile = await User.findById(recipientId).select('preferred_language').lean().catch(() => null);
    const recipientLanguage = recipientProfile?.preferred_language === 'fr' ? 'fr' : 'en';
    const localizedTitle = translateNotificationText(title, recipientLanguage);
    const localizedMessage = translateNotificationText(message, recipientLanguage);

    // 1. Create DB Record (Synchronous to ensure ID exists)
    const notification = await Notification.create({
      recipient: recipientId, title: localizedTitle, message: localizedMessage, type, metadata
    });

    const io = app.get('io');
    // 🚀 REDUNDANCY GUARD: Chat messages already emit 'receive_message' in the controller.
    if (io && type !== 'message') {
      io.to(recipientId.toString()).emit('notification', notification);
    }

    // ─────────────────────────────────────────────
    // NON-BLOCKING BACKGROUND CHANNELS
    // ─────────────────────────────────────────────
    
    // 🚀 CHANNEL 1: PWA WEB PUSH (ULTRA-FAST PATH)
    enqueueJob('push', async () => {
      try {
        const PushSubscription = require('../models/PushSubscription.model');
        const subs = await PushSubscription.find({ user_id: recipientId });

        if (subs.length > 0) {
          const notificationUrl = metadata?.link || '/discovery';

          // Use sender avatar for chat notifications, app logo for everything else
          const iconUrl = (type === 'message' && senderAvatar)
            ? senderAvatar
            : '/logo-white.png';

          const senderId = metadata?.sender_id || metadata?.senderId;

          const payload = JSON.stringify({
            title: localizedTitle,
            body: localizedMessage,
            icon: iconUrl,
            image: (type === 'message' && senderAvatar) ? senderAvatar : undefined,
            tag: (type === 'message' && senderId) ? `msg-${senderId}` : `alert-${recipientId}-${Date.now()}`,
            data: { 
              url: notificationUrl,
              sender_id: senderId,
              senderId: senderId,
              notification_id: notification._id.toString(),
              type
            },
            sender_id: senderId,
            senderId: senderId,
            notification_id: notification._id.toString(),
            type
          });

          const results = await Promise.allSettled(subs.map(sub => 
            webPush.sendNotification(sub.subscription, payload, WEB_PUSH_OPTIONS)
              .catch(async (e) => {
                if (e.statusCode === 410 || e.statusCode === 404 || e.statusCode === 401) {
                  await PushSubscription.deleteOne({ _id: sub._id }).catch(() => {});
                  console.log(`🗑️  Purged invalid sub ${sub._id} (HTTP ${e.statusCode})`);
                }
                throw e;
              })
          ));
          const delivered = results.filter(result => result.status === 'fulfilled').length;
          const failed = results.length - delivered;
          console.log(`📱 PWA Push Signal Broadcasted to ${delivered}/${subs.length} connections for ${recipientId}${failed ? ` (${failed} failed)` : ''}`);
        } else {
          console.log(`[PWA] No saved push subscriptions for ${recipientId}; notification stored only (${type}).`);
        }
      } catch (err) {
        console.error('❌ PWA Push Signal Error:', err.message);
      }
    }, { recipientId: recipientId.toString(), notificationId: notification._id.toString(), type });

    // 🚀 CHANNEL 2: EMAIL DISPATCH (RELIABILITY PATH)
    if (sendEmail && EMAIL_USER) {
      enqueueJob('email', async () => {
        try {
          const EmailLog = require('../models/EmailLog.model');
          const user = await User.findById(recipientId).select('email name role preferred_language');
          let targetEmail = overrideEmail || user?.email;

          if (role === 'logistics' && !overrideEmail) {
            const LogisticsCompany = require('../models/LogisticsCompany.model');
            const firm = await LogisticsCompany.findOne({ user_id: recipientId }).select('contact_email');
            if (firm?.contact_email) targetEmail = firm.contact_email;
          }
          
          if (targetEmail) {
            const success = await dispatchEmail({
              to: targetEmail,
              subject: localizedTitle,
              text: localizedMessage,
              html: emailTemplate?.html || buildOrderEmailHtml(localizedTitle, localizedMessage, orderDetails, role, emailLink, qrCode, webUrl),
              role: role || 'user'
            });

            if (success) {
              await EmailLog.create({
                recipient_email: targetEmail,
                recipient_user_id: recipientId,
                subject: localizedTitle || 'Auradime Signal',
                message_preview: localizedMessage ? localizedMessage.substring(0, 100) : '',
                role: role || 'user',
                status: 'sent'
              });
              console.log(`📧 Email Signal Delivered via Shared Service to ${targetEmail}`);
            }
          }
        } catch (err) {
          console.error('❌ Email Signal Dispatch Error:', err.message);
        }
      }, { recipientId: recipientId.toString(), type, title: localizedTitle });
    }

    return notification;
  } catch (err) {
    console.error('❌ Auradime Dispatch Fail:', err);
  }
};

const notifyFollowers = async (app, vendorId, data) => {
  try {
    const Follow = require('../models/Follow.model');
    const followers = await Follow.find({ vendor_id: vendorId });
    await Promise.allSettled(followers.map(f => sendNotification(app, f.user_id, { ...data, type: 'vendor_update' })));
  } catch (err) {
    console.error('Follower broadcast fail:', err);
  }
};

module.exports = { sendNotification, notifyFollowers };
