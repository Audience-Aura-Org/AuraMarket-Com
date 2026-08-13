/**
 * scripts/test_eversend.js
 * Smoke-test Eversend: auth, wallet balance, collection, and withdrawal quotation.
 *
 * What this tests:
 *   1. Auth         — fetch access token (confirms credentials + IP whitelist)
 *   2. Wallets      — list wallets and XAF balance
 *   3. Collection   — initiate an XAF mobile money collection (MTN or Orange)
 *   4. Withdrawal   — payout QUOTATION only (step 1) — no money moves
 *
 * Usage:
 *   node backend/scripts/test_eversend.js
 *
 * Environment overrides (optional — set in .env or inline):
 *   TEST_EVERSEND_PHONE=+237651000001   Phone to collect from (E.164)
 *   TEST_EVERSEND_COUNTRY=CM            Country code
 *   TEST_PAYOUT_PHONE=+237651000002     Phone to test payout quotation toward
 *   TEST_AMOUNT=100                     Amount in XAF
 *
 * NOTE: The test collection will push an STK prompt to TEST_EVERSEND_PHONE if
 * your Eversend account is live-enabled. To avoid this, set EVERSEND_SANDBOX_MODE=true
 * in your .env — that path creates no Eversend API calls.
 *
 * The payout test stops at getPayoutQuotation (no money moves).
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const eversend = require('../services/eversend.service');
const crypto   = require('crypto');

const AMOUNT         = Number(process.env.TEST_AMOUNT         || 100);
const COLLECT_PHONE  = process.env.TEST_EVERSEND_PHONE        || '+237651000001';
const COLLECT_COUNTRY = process.env.TEST_EVERSEND_COUNTRY     || 'CM';
const PAYOUT_PHONE   = process.env.TEST_PAYOUT_PHONE          || '+237651000002';

const sep  = (label) => console.log(`\n${'─'.repeat(60)}\n  ${label}\n${'─'.repeat(60)}`);
const pass = (msg)   => console.log(`  ✓  ${msg}`);
const fail = (msg, err) => {
  console.error(`  ✗  ${msg}`);
  const detail = err?.response?.data || err?.message || err;
  console.error('     ', typeof detail === 'object' ? JSON.stringify(detail, null, 2) : detail);
};

(async () => {
  console.log('\n[Eversend Test] Starting\n');
  console.log(`  Collection phone : ${COLLECT_PHONE} (${COLLECT_COUNTRY})`);
  console.log(`  Payout phone     : ${PAYOUT_PHONE}`);
  console.log(`  Amount           : ${AMOUNT} XAF`);

  // ── 1. Auth ──────────────────────────────────────────────────────────────────
  sep('Test 1 — Auth (get access token)');
  let token;
  try {
    token = await eversend.getAccessToken(true); // force fresh
    if (token?.startsWith('mock')) {
      console.log('  ⚠  Mock token returned — IP whitelist error or development mode');
      console.log(`  Token: ${token}`);
    } else {
      pass(`Token acquired (${token.slice(0, 20)}...)`);
    }
  } catch (e) {
    fail('Auth failed', e);
    console.log('\n[Eversend Test] Cannot continue without a valid token.\n');
    process.exit(1);
  }

  // ── 2. Wallets ───────────────────────────────────────────────────────────────
  sep('Test 2 — Wallets (list + XAF balance)');
  try {
    const wallets = await eversend.getWallets();
    const list = wallets?.data || wallets?.wallets || wallets;
    if (Array.isArray(list)) {
      pass(`Found ${list.length} wallet(s)`);
      list.forEach(w => {
        const marker = w.currency === 'XAF' ? ' ← XAF' : '';
        console.log(`  · ${w.currency}: ${w.balance}${marker}`);
      });
      const xaf = list.find(w => w.currency === 'XAF');
      if (xaf) {
        console.log(`\n  XAF balance: ${xaf.balance} XAF`);
        if (xaf.balance < AMOUNT) {
          console.log('  ⚠  XAF balance is lower than test amount — payout quotation may warn of insufficient funds');
        }
      }
    } else {
      pass('Wallet response received (unexpected shape)');
      console.log('  Raw:', JSON.stringify(wallets, null, 4));
    }
  } catch (e) {
    fail('Wallet list failed', e);
  }

  // ── 3. Collection — MTN / Orange ─────────────────────────────────────────────
  sep(`Test 3 — Collection (${COLLECT_PHONE} / ${COLLECT_COUNTRY})`);
  const txRef = `AURA-TEST-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  console.log(`  Transaction ref: ${txRef}`);

  let collectionTxId = null;
  try {
    const result = await eversend.initiateCollection({
      amount:         AMOUNT,
      currency:       'XAF',
      phone:          COLLECT_PHONE,
      country:        COLLECT_COUNTRY,
      firstName:      'Test',
      lastName:       'User',
      email:          'test@auradime.com',
      transactionRef: txRef,
    });

    const data = result?.data || result;
    collectionTxId = data?.transactionId || data?.transaction_id || data?.id || null;
    pass(`Collection initiated — gateway tx ID: ${collectionTxId || '(not returned yet)'}`);
    console.log('  Raw:', JSON.stringify(result, null, 4));

    // ── 3b. Status poll ─────────────────────────────────────────────────────────
    if (collectionTxId) {
      sep('Test 3b — Collection status poll');
      try {
        const statusRes = await eversend.getTransactionStatus(collectionTxId);
        const status = statusRes?.data?.status || statusRes?.status || 'UNKNOWN';
        pass(`Status: ${status}`);
        console.log('  Raw:', JSON.stringify(statusRes, null, 4));
      } catch (e) {
        fail('Status poll failed', e);
      }
    } else {
      // Try getCollectionByRef if no gatewayTxId returned
      sep('Test 3b — Collection lookup by ref (no txId in response)');
      try {
        const byRef = await eversend.getCollectionByRef(txRef);
        pass('Lookup by ref succeeded');
        console.log('  Raw:', JSON.stringify(byRef, null, 4));
      } catch (e) {
        fail('Lookup by ref failed', e);
      }
    }
  } catch (e) {
    fail('Collection initiation failed', e);
  }

  // ── 4. Withdrawal — Payout Quotation (no money moves) ────────────────────────
  sep(`Test 4 — Payout Quotation (${AMOUNT} XAF → momo → ${PAYOUT_PHONE})`);
  console.log('  NOTE: This only fetches a quote. No payout is executed.');
  try {
    const quote = await eversend.getPayoutQuotation(
      AMOUNT,
      'XAF',
      'XAF',
      COLLECT_COUNTRY,
      'momo'
    );

    const qData = quote?.data || quote;
    const quotationToken = qData?.token || quote?.token;
    const fee            = qData?.quotation?.fee ?? qData?.fee ?? 'n/a';
    const balanceAfter   = qData?.quotation?.sourceCurrencyBalanceAfter ?? 'n/a';

    pass(`Quotation received — fee: ${fee} XAF · balance after: ${balanceAfter} XAF`);
    console.log(`  Quotation token: ${quotationToken ? quotationToken.slice(0, 30) + '...' : 'NOT returned'}`);
    console.log('  Full quotation response:', JSON.stringify(quote, null, 4));

    if (!quotationToken) {
      console.log('  ⚠  No quotation token in response — check Eversend wallet balance and account status');
    } else {
      console.log('\n  ✓  Withdrawal path is reachable. To send a real payout, an admin');
      console.log('     would call executeMomoPayout(quotationToken, phone, ...)');
    }
  } catch (e) {
    fail('Payout quotation failed', e);
  }

  console.log('\n[Eversend Test] Done\n');
  process.exit(0);
})().catch(err => {
  console.error('[Eversend Test] Unhandled error:', err.message);
  process.exit(1);
});
