/**
 * scripts/test_payunit.js
 * Smoke-test PayUnit gateway for MTN MoMo and Orange Money.
 *
 * What this tests:
 *   1. Auth — can we reach gateway.payunit.net with our credentials?
 *   2. MTN payment — sends a real (or test) makepayment request
 *   3. Orange payment — same with an Orange number
 *   4. Status poll  — confirms the status endpoint is reachable
 *
 * Usage:
 *   node backend/scripts/test_payunit.js
 *
 * Set PAYUNIT_MODE=test in your .env to use the sandbox key and not
 * push a real prompt to the phone. Change MTN_PHONE / ORANGE_PHONE
 * to real numbers if you want the STK push to land on an actual device.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const payunit = require('../services/payunit.service');

const NET_AMOUNT   = 100;         // XAF net (what the user pays)
const COLLECTION_FEE = 50;        // XAF — same as MOBILE_MONEY_COLLECTION_FEE_XAF in .env
const AMOUNT       = NET_AMOUNT + COLLECTION_FEE; // 150 XAF gross — matches production
const RETURN_URL  = 'https://auradime.com/wallet/verify?gateway=payunit';
const NOTIFY_URL  = 'https://auradime.com/api/payments/payunit/webhook';

// ── IMPORTANT: use dummy/non-existent numbers by default ─────────────────────
// These are placeholder numbers that let us verify the API flow without sending
// a real USSD prompt to a live subscriber. If a real USSD push is needed,
// pass TEST_MTN_PHONE / TEST_ORANGE_PHONE env vars — but be aware that an
// unapproved pending collection will block new requests for ~10 minutes.
// NEVER use the same number here that real users are depositing from.
const MTN_PHONE    = process.env.TEST_MTN_PHONE    || '651000001'; // 9-digit local
const ORANGE_PHONE = process.env.TEST_ORANGE_PHONE || '655000001'; // 9-digit local

const sep = (label) => console.log(`\n${'─'.repeat(60)}\n  ${label}\n${'─'.repeat(60)}`);
const pass = (msg) => console.log(`  ✓  ${msg}`);
const fail = (msg, err) => {
  console.error(`  ✗  ${msg}`);
  const detail = err?.response?.data || err?.message || err;
  console.error('     ', typeof detail === 'object' ? JSON.stringify(detail, null, 2) : detail);
};

(async () => {
  console.log(`\n[PayUnit Test] mode=${payunit.getMode()}\n`);

  // ── 1. MTN MoMo ─────────────────────────────────────────────────────────────
  sep('Test 1 — MTN MoMo (CM_MTNMOMO)');
  const detectedMtn = payunit.detectCmProvider(MTN_PHONE);
  console.log(`  Phone: ${MTN_PHONE} → detected provider: ${detectedMtn}`);

  const mtnTxId = `TEST-MTN-${Date.now()}`;
  try {
    // Step 1: initialize (required before makepayment)
    const initMtn = await payunit.initializePayment({
      amount:        AMOUNT,
      currency:      'XAF',
      transactionId: mtnTxId,
      returnUrl:     RETURN_URL,
      notifyUrl:     NOTIFY_URL,
    });
    pass(`MTN init accepted — ref: ${mtnTxId}`);
    console.log('  Init response:', JSON.stringify(initMtn.raw, null, 4));

    // Step 2: trigger mobile push with same transactionId
    const { raw, data } = await payunit.makeMobilePayment({
      amount:        AMOUNT,
      currency:      'XAF',
      transactionId: mtnTxId,
      returnUrl:     RETURN_URL,
      notifyUrl:     NOTIFY_URL,
      phone:         MTN_PHONE,
      provider:      detectedMtn,
    });
    pass(`MTN request accepted — PayUnit tx ref: ${data?.transaction_id || mtnTxId}`);
    console.log('  Raw response:', JSON.stringify(raw, null, 4));

    // ── Status check ──────────────────────────────────────────────────────────
    sep('Test 1b — MTN status poll');
    const txIdForStatus = data?.transaction_id || mtnTxId;
    try {
      const statusRes = await payunit.getPaymentStatus(txIdForStatus);
      const normalized = payunit.normalizeStatus(statusRes.data);
      pass(`Status poll OK — status: ${normalized}`);
      console.log('  Raw status:', JSON.stringify(statusRes.raw, null, 4));
    } catch (e) {
      fail('Status poll failed', e);
    }
  } catch (e) {
    fail('MTN makepayment failed', e);
  }

  // ── 2. Orange Money ──────────────────────────────────────────────────────────
  sep('Test 2 — Orange Money (CM_ORANGE)');
  const detectedOrange = payunit.detectCmProvider(ORANGE_PHONE);
  console.log(`  Phone: ${ORANGE_PHONE} → detected provider: ${detectedOrange}`);

  const orangeTxId = `TEST-ORA-${Date.now()}`;
  try {
    // Step 1: initialize
    const initOrange = await payunit.initializePayment({
      amount:        AMOUNT,
      currency:      'XAF',
      transactionId: orangeTxId,
      returnUrl:     RETURN_URL,
      notifyUrl:     NOTIFY_URL,
    });
    pass(`Orange init accepted — ref: ${orangeTxId}`);
    console.log('  Init response:', JSON.stringify(initOrange.raw, null, 4));

    // Step 2: trigger mobile push with same transactionId
    const { raw, data } = await payunit.makeMobilePayment({
      amount:        AMOUNT,
      currency:      'XAF',
      transactionId: orangeTxId,
      returnUrl:     RETURN_URL,
      notifyUrl:     NOTIFY_URL,
      phone:         ORANGE_PHONE,
      provider:      detectedOrange,
    });
    pass(`Orange request accepted — PayUnit tx ref: ${data?.transaction_id || orangeTxId}`);
    console.log('  Raw response:', JSON.stringify(raw, null, 4));
  } catch (e) {
    fail('Orange makepayment failed', e);
  }

  console.log('\n[PayUnit Test] Done\n');
  process.exit(0);
})().catch(err => {
  console.error('[PayUnit Test] Unhandled error:', err.message);
  process.exit(1);
});
