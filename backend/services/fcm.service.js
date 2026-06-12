let messaging = null;
let initAttempted = false;

const parseServiceAccount = () => {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    return JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8'));
  }

  return null;
};

const initialize = () => {
  if (messaging || initAttempted) return messaging;
  initAttempted = true;

  try {
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
      const serviceAccount = parseServiceAccount();
      admin.initializeApp(serviceAccount
        ? { credential: admin.credential.cert(serviceAccount) }
        : { credential: admin.credential.applicationDefault() });
    }
    messaging = admin.messaging();
    console.log('✅ [FCM] Firebase Admin initialized for Android push.');
  } catch (error) {
    messaging = null;
    console.warn(`⚠️ [FCM] Android push disabled: ${error.message}`);
  }

  return messaging;
};

const sendAndroidPush = async (tokens, payload) => {
  const client = initialize();
  const cleanTokens = [...new Set((tokens || []).filter(Boolean))];
  if (!client || cleanTokens.length === 0) {
    return { sent: 0, failed: cleanTokens.length, invalidTokens: [] };
  }

  const response = await client.sendEachForMulticast({
    tokens: cleanTokens,
    notification: {
      title: payload.title || 'Auradime',
      body: payload.body || '',
      imageUrl: payload.image || undefined,
    },
    data: Object.fromEntries(
      Object.entries({
        url: payload.url || '/notifications',
        type: payload.type || 'notification',
        notification_id: payload.notification_id || '',
        sender_id: payload.sender_id || payload.senderId || '',
        senderId: payload.senderId || payload.sender_id || '',
      }).map(([key, value]) => [key, String(value ?? '')])
    ),
    android: {
      priority: 'high',
      notification: {
        channelId: 'auradime_default',
        color: '#f20df2',
        clickAction: 'FCM_PLUGIN_ACTIVITY',
      },
    },
  });

  const invalidTokens = [];
  response.responses.forEach((result, index) => {
    if (!result.success) {
      const code = result.error?.code || '';
      if (
        code.includes('registration-token-not-registered') ||
        code.includes('invalid-registration-token') ||
        code.includes('invalid-argument')
      ) {
        invalidTokens.push(cleanTokens[index]);
      }
    }
  });

  return { sent: response.successCount, failed: response.failureCount, invalidTokens };
};

module.exports = { sendAndroidPush };
