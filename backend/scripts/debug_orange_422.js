/**
 * scripts/debug_orange_422.js
 *
 * Full diagnostic for the Orange Money CM 422 / "duplicate pending collection" issue.
 *
 * What it does:
 *   1. Connects to production DB and lists all recent PayUnit transactions for
 *      the affected phone so you can see what our system recorded.
 *   2. For each transaction that has a reference, polls PayUnit's status endpoint
 *      to see what PayUnit currently thinks the state is.
 *   3. Sends a minimal dry-run makepayment to detect whether Orange's pending
 *      lock is STILL active (expects 422/417) or has expired (expects PENDING
 *      or a non-422 response).
 *
 * Usage:
 *   node backend/scripts/debug_orange_422.js [phone]
 *
 * Example:
 *   node backend/scripts/debug_orange_422.js 658928598
 *
 * The [phone] arg can be 9-digit local (658928598), local with 0 (0658928598),
 * or international (+237658928598 / 237658928598).
 *
 * Set SKIP_PROBE=true to skip the live makepayment probe (DB + status only):
 *   SKIP_PROBE=true node backend/scripts/debug_orange_422.js 658928598
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose  = require('mongoose');
const payunit   = require('../services/payunit.service');
const Transaction = require('../models/Transaction.model');

// ── Config ───────────────────────────────────────────────────────────────────
const rawPhone  = process.argv[2] || process.env.DEBUG_PHONE || '658928598';
const localPhone = payunit.normalizePhone(rawPhone, 'CM');          // 9-digit
const intlPhone  = payunit.normalizePhoneIntl(rawPhone, 'CM');      // +237...
const provider   = payunit.detectCmProvider(localPhone);

const SKIP_PROBE = process.env.SKIP_PROBE === 'true';
const HOURS_BACK = Number(process.env.HOURS_BACK || 24);

const sep  = (label) => console.log(`\n${'═'.repeat(70)}\n  ${label}\n${'═'.repeat(70)}`);
const ok   = (msg)   => console.log(`  ✓  ${msg}`);
const warn = (msg)   => console.log(`  ⚠  ${msg}`);
const err  = (msg, e) => {
  console.error(`  ✗  ${msg}`);
  const d = e?.response?.data || e?.message || e;
  console.error('     ', typeof d === 'object' ? JSON.stringify(d, null, 4) : d);
};

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log(`\n[debug_orange_422] PayUnit mode: ${payunit.getMode()}`);
  console.log(`[debug_orange_422] Phone input : ${rawPhone}`);
  console.log(`[debug_orange_422] Normalized  : local=${localPhone}  intl=${intlPhone}`);
  console.log(`[debug_orange_422] Provider    : ${provider}`);
  console.log(`[debug_orange_422] Looking back: ${HOURS_BACK}h\n`);

  // ── 1. DB audit ────────────────────────────────────────────────────────────
  sep('SECTION 1 — DB transactions for this phone');
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL);
  console.log('  DB connected');

  const since = new Date(Date.now() - HOURS_BACK * 60 * 60 * 1000);
  const txns = await Transaction.find({
    gateway: 'payunit',
    $or: [
      { 'metadata.phone': intlPhone },
      { 'metadata.phone': localPhone },
      { 'metadata.phone': rawPhone },
    ],
    createdAt: { $gte: since },
  }).sort({ createdAt: -1 }).limit(20).lean();

  if (txns.length === 0) {
    warn(`No PayUnit transactions found for ${intlPhone} in the last ${HOURS_BACK}h.`);
    warn('This phone was only used in test scripts (not stored in DB).');
  } else {
    console.log(`  Found ${txns.length} transaction(s):`);
    for (const t of txns) {
      console.log(`\n  ── ${t.reference}`);
      console.log(`     status   : ${t.status}`);
      console.log(`     type     : ${t.type}`);
      console.log(`     amount   : ${t.amount} XAF`);
      console.log(`     created  : ${t.createdAt.toISOString()}`);
      const gwr   = t.gateway_response || {};
      const init  = gwr.initialize?.data  || gwr.initialize;
      const mpay  = gwr.makepayment?.data || gwr.makepayment;
      if (init?.transaction_id)       console.log(`     init_id  : ${init.transaction_id}`);
      if (mpay?.payment_status)       console.log(`     pay_stat : ${mpay.payment_status}`);
      if (mpay?.transaction_status)   console.log(`     tx_stat  : ${mpay.transaction_status}`);
      const initMsg = gwr.initialize?.message || gwr.initialize?.raw?.message;
      const mpayMsg = gwr.makepayment?.message || gwr.makepayment?.raw?.message;
      if (initMsg) console.log(`     init_msg : ${initMsg}`);
      if (mpayMsg) console.log(`     mpay_msg : ${mpayMsg}`);
    }
  }

  // ── 2. Poll PayUnit status for each known reference ────────────────────────
  sep('SECTION 2 — PayUnit status poll for each DB reference');
  if (txns.length === 0) {
    warn('No DB references to poll — skipping.');
  }
  for (const t of txns) {
    if (!t.reference) continue;
    try {
      const { raw, data } = await payunit.getPaymentStatus(t.reference);
      const normalized = payunit.normalizeStatus(data);
      ok(`${t.reference} → status: ${normalized}`);
      console.log('     raw:', JSON.stringify(raw, null, 4));
    } catch (e) {
      err(`Status poll failed for ${t.reference}`, e);
    }
  }

  // ── 3. Live probe — check whether 658928598 is still locked ──────────────
  sep('SECTION 3 — Live makepayment probe');

  if (SKIP_PROBE) {
    warn('SKIP_PROBE=true — skipping live probe. Set SKIP_PROBE=false to enable.');
    await mongoose.disconnect();
    console.log('\n[debug_orange_422] Done.\n');
    process.exit(0);
  }

  // We send a real initialize + makepayment.
  // ► If Orange STILL has a pending lock  → PayUnit returns 417/422 → this is the bug
  // ► If lock has expired                 → PayUnit returns PENDING → user will get USSD
  // ► If some other error                 → we surface it for diagnosis
  //
  // IMPORTANT: if this probe SUCCEEDS (PENDING), a real USSD prompt will be sent
  // to 658928598. The user should approve or decline it immediately.

  const probeRef = payunit.cleanTransactionId(
    `DBGPU${Date.now()}${localPhone.slice(-4)}`.toUpperCase()
  );
  const publicWebUrl = process.env.WEB_CLIENT_URL || 'https://auradime.com';
  const returnUrl = `${publicWebUrl}/wallet/verify?gateway=payunit&ref=${probeRef}`;
  const notifyUrl = `${process.env.API_PUBLIC_URL || process.env.BACKEND_PUBLIC_URL || 'https://api.auradime.com'}/api/v1/payments/payunit/webhook`;

  console.log(`\n  Probe ref : ${probeRef}`);
  console.log(`  Provider  : ${provider}`);
  console.log(`  Amount    : 100 XAF (minimum test — no fee added)`);
  console.log(`  Phone     : ${localPhone}`);
  console.log('');

  // Step 1: initialize
  let initResult;
  try {
    initResult = await payunit.initializePayment({
      amount: 100,
      currency: 'XAF',
      transactionId: probeRef,
      returnUrl,
      notifyUrl,
      country: 'CM',
    });
    ok(`initialize OK — ref: ${probeRef}`);
    console.log('  Init response:', JSON.stringify(initResult.raw, null, 4));
  } catch (e) {
    err('initialize FAILED — PayUnit rejected the init itself', e);
    console.log('\n  DIAGNOSIS: The 417/error is coming from /initialize, not /makepayment.');
    console.log('  Check: notify_url and return_url must be HTTPS. Current values:');
    console.log(`    return_url : ${returnUrl}`);
    console.log(`    notify_url : ${notifyUrl}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  // Step 2: makepayment
  try {
    const mpResult = await payunit.makeMobilePayment({
      amount: 100,
      currency: 'XAF',
      transactionId: probeRef,
      returnUrl,
      notifyUrl,
      phone: localPhone,
      provider,
    });
    ok(`makepayment ACCEPTED — Orange pending lock has EXPIRED`);
    console.log('  Response:', JSON.stringify(mpResult.raw, null, 4));
    console.log('');
    warn('A real USSD prompt has been sent to ' + intlPhone);
    warn('Please approve or decline it immediately on the handset.');
  } catch (e) {
    const status = e?.response?.status;
    const body   = e?.response?.data;
    if (status === 417 || status === 422) {
      err(`makepayment returned ${status} — Orange Money lock is STILL ACTIVE`, e);
      console.log('');
      console.log('  DIAGNOSIS: Orange Money CM still has a pending USSD collection');
      console.log('  for subscriber ' + intlPhone + '.');
      console.log('  The lock was created by earlier test runs and has NOT yet expired.');
      console.log('');
      console.log('  ACTIONS REQUIRED (pick one):');
      console.log('  A) Email info@payunit.net — ask them to void pending collections for');
      console.log('     subscriber ' + intlPhone + ' on CM_ORANGE.');
      console.log('  B) Person with ' + intlPhone + ' dials #150*50# and cancels the');
      console.log('     pending USSD prompt from the handset menu.');
      console.log('  C) Wait for Orange\'s lock to expire (unknown duration, typically');
      console.log('     10–60 min; possibly up to 24h on CM_ORANGE).');
    } else {
      err(`makepayment returned unexpected error (status ${status})`, e);
      console.log('  Raw error body:', JSON.stringify(body, null, 4));
      console.log('');
      console.log('  DIAGNOSIS: This is a NEW error type — not the duplicate-pending 422.');
      console.log('  Check the raw body above and the PayUnit dashboard for more detail.');
    }
  }

  await mongoose.disconnect();
  console.log('\n[debug_orange_422] Done.\n');
  process.exit(0);
})().catch(e => {
  console.error('[debug_orange_422] Unhandled error:', e.message);
  process.exit(1);
});
