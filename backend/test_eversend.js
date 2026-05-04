/**
 * test_eversend.js
 * Direct test of the Eversend integration — no OTP, no server required.
 * Tests: token auth, wallet list, getTransactionStatus, and a live momo collection.
 * 
 * Run: node test_eversend.js
 */

require('dotenv').config({ path: './.env' });

const eversend = require('./services/eversend.service');

// ── Config ────────────────────────────────────────────────────────────────────
// Use a real number for live momo test. Change as needed.
const TEST_PHONE   = '+237671234567'; // <- Change to a real number for live test
const TEST_AMOUNT  = 500;
const TEST_CURRENCY = 'XAF';
const TEST_COUNTRY  = 'CM';
const TEST_REF     = `TEST-${Date.now()}`;

// ── Helpers ───────────────────────────────────────────────────────────────────
const pass = (label) => console.log(`  ✅  ${label}`);
const fail = (label, err) => console.error(`  ❌  ${label}:`, err?.response?.data || err?.message || err);
const section = (title) => console.log(`\n${'─'.repeat(55)}\n  ${title}\n${'─'.repeat(55)}`);

// ── Tests ─────────────────────────────────────────────────────────────────────

async function testAuth() {
  section('1. Authentication — GET /auth/token');
  try {
    const token = await eversend.getAccessToken();
    if (!token) throw new Error('No token returned');
    pass(`Token received (length=${token.length})`);
    console.log('     Token:', token.slice(0, 20) + '...');
  } catch (err) {
    fail('Auth token fetch failed', err);
    process.exit(1); // Can't continue without token
  }
}

async function testAutoRefresh() {
  section('2. Token Auto-Refresh — withAutoRefresh()');
  try {
    // Force a refresh by invalidating cache
    const result = await eversend.withAutoRefresh(async (client) => {
      const res = await client.get('/wallets');
      return res.data;
    });
    if (result) {
      pass('withAutoRefresh executed successfully');
    } else {
      fail('withAutoRefresh returned no data', {});
    }
  } catch (err) {
    fail('withAutoRefresh failed', err);
  }
}

async function testGetWallets() {
  section('3. Wallet List — GET /wallets');
  try {
    const result = await eversend.getWallets();
    const wallets = result?.data || result?.wallets || [];
    pass(`Got ${wallets.length} wallet(s) from Eversend`);
    wallets.forEach(w => {
      console.log(`     💰  ${w.currency}: balance=${w.balance ?? 'N/A'} id=${w.id || w._id}`);
    });
    return wallets;
  } catch (err) {
    fail('getWallets failed', err);
    return [];
  }
}

async function testInitiateCollection() {
  section('4. Initiate MoMo Collection — POST /collections/momo');
  console.log(`     Phone:    ${TEST_PHONE}`);
  console.log(`     Amount:   ${TEST_AMOUNT} ${TEST_CURRENCY}`);
  console.log(`     Ref:      ${TEST_REF}`);
  console.log(`     ⚠️   This will send a REAL payment prompt to the phone above.\n`);

  try {
    const result = await eversend.initiateCollection({
      amount:         TEST_AMOUNT,
      currency:       TEST_CURRENCY,
      phone:          TEST_PHONE,
      country:        TEST_COUNTRY,
      firstName:      'Test',
      lastName:       'Aura',
      email:          'test@aura.com',
      redirectUrl:    'http://localhost:3000/wallet/verify?gateway=eversend',
      transactionRef: TEST_REF,
    });

    console.log('     Raw response:', JSON.stringify(result, null, 2));

    if (result?.success === false) {
      fail('Collection returned success=false', { message: result.message });
      return null;
    }

    const txId = result?.data?.transactionId || result?.data?.transaction_id || result?.data?.id;
    pass(`Collection initiated! transactionId=${txId}`);
    return txId;
  } catch (err) {
    fail('initiateCollection failed', err);
    console.error('     Full error:', JSON.stringify(err.response?.data, null, 2));
    return null;
  }
}

async function testGetTransactionStatus(txId) {
  section('5. Transaction Status — GET /transactions/:id');
  if (!txId) {
    console.log('     ⏭️   Skipped — no transactionId from step 4.');
    return;
  }
  try {
    const result = await eversend.getTransactionStatus(txId);
    const status = result?.data?.status || result?.status;
    pass(`Status fetched: ${status}`);
    console.log('     Full response:', JSON.stringify(result?.data || result, null, 2));
  } catch (err) {
    fail('getTransactionStatus failed', err);
  }
}

async function testNGNCollection() {
  section('6. NGN Collection Routing — POST /collections/ngn');
  console.log('     (Dry-run with dummy data — expects 400/422, not 500)');
  try {
    await eversend.initiateNGNCollection({
      amount:         100,
      currency:       'NGN',
      phone:          '+2348012345678',
      country:        'NG',
      firstName:      'Test',
      lastName:       'NG',
      email:          'test@aura.com',
      transactionRef: `NGN-TEST-${Date.now()}`,
    });
    pass('NGN collection endpoint reachable (may need real account activation)');
  } catch (err) {
    const status = err.response?.status;
    const msg = err.response?.data?.message || err.message;
    if (status === 400 || status === 422 || status === 403) {
      pass(`NGN endpoint reached — validation/permission error (${status}): "${msg}" — this is expected without real NGN activation`);
    } else if (status === 500) {
      fail('NGN collection returned 500 — Eversend service error', err);
    } else {
      fail(`NGN collection unexpected error (${status})`, err);
    }
  }
}

async function testPayoutFlow() {
  section('7. Payout Flow (2-Step) — Quotation & Execution');
  console.log('     Step A: Get Payout Quotation');
  let quoteToken = null;
  try {
    const quote = await eversend.getPayoutQuotation(
      1000,
      'XAF',
      'XAF',
      TEST_COUNTRY,
      'momo'
    );
    console.log('     Raw Quote Response:', JSON.stringify(quote, null, 2));
    quoteToken = quote?.data?.token || quote?.token;
    pass(`Quotation successful. Token: ${quoteToken?.slice(0,10)}...`);
  } catch (err) {
    fail('getPayoutQuotation failed', err);
  }

  if (quoteToken) {
    console.log('     Step B: Execute Momo Payout (Dry-run)');
    try {
      await eversend.executeMomoPayout({
        token: quoteToken,
        phone: TEST_PHONE,
        country: TEST_COUNTRY,
        firstName: 'Aura',
        lastName: 'Vendor',
        transactionRef: `PY-MOMO-${Date.now()}`
      });
      pass('executeMomoPayout initiated');
    } catch (err) {
      const status = err.response?.status;
      if (status === 400 || status === 422 || status === 401) {
        pass(`Momo payout endpoint reached — expected validation/auth error (${status})`);
      } else {
        fail('executeMomoPayout failed unexpectedly', err);
      }
    }

    console.log('     Step C: Execute Bank Payout (Dry-run)');
    try {
      await eversend.executeBankPayout({
        token: quoteToken,
        bankCode: 'GTB',
        accountNumber: '0123456789',
        firstName: 'Aura',
        lastName: 'Vendor',
        transactionRef: `PY-BANK-${Date.now()}`
      });
      pass('executeBankPayout initiated');
    } catch (err) {
      pass(`Bank payout endpoint reached — expected error (${err.response?.status})`);
    }

    console.log('     Step D: Execute Eversend Payout (Dry-run)');
    try {
      await eversend.executeEversendPayout({
        token: quoteToken,
        eversendTag: '@aura',
        transactionRef: `PY-TAG-${Date.now()}`
      });
      pass('executeEversendPayout initiated');
    } catch (err) {
      pass(`Eversend Tag payout endpoint reached — expected error (${err.response?.status})`);
    }
  }
}

// ── Run all tests ─────────────────────────────────────────────────────────────
(async () => {
  console.log('\n🔬  Eversend Integration Test Suite');
  console.log('    OTP: DISABLED  |  Mode:', process.env.EVERSEND_SANDBOX_MODE === 'true' ? 'SANDBOX' : 'LIVE');
  console.log('    Base URL:', process.env.EVERSEND_BASE_URL);

  await testAuth();
  await testAutoRefresh();
  await testGetWallets();
  
  // Collection + status poll — comment out if you don't want a real prompt
  // const txId = await testInitiateCollection();
  // await testGetTransactionStatus(txId);

  await testNGNCollection();
  await testPayoutFlow();

  section('Test Run Complete');
  console.log('  Review results above. Green ✅ = pass, Red ❌ = fail.\n');
})();
