/**
 * scripts/test-eversend-otp.js
 * Run on EC2 to diagnose OTP and collection failures:
 *   node scripts/test-eversend-otp.js
 */

require('dotenv').config();
const axios = require('axios');

const BASE = process.env.EVERSEND_BASE_URL || 'https://api.eversend.co/v1';
const CLIENT_ID = process.env.EVERSEND_CLIENT_ID;
const CLIENT_SECRET = process.env.EVERSEND_CLIENT_SECRET;

// ── Change these to real test values ─────────────────────────────────────────
const TEST_PHONE = '+237651188134';   // E.164 format
const TEST_COUNTRY = 'CM';
const TEST_CURRENCY = 'XAF';
const TEST_AMOUNT = 100;
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  console.log('\n═══════════════════════════════════════');
  console.log(' Eversend OTP Diagnostic');
  console.log('═══════════════════════════════════════');
  console.log('BASE_URL  :', BASE);
  console.log('CLIENT_ID :', CLIENT_ID ? CLIENT_ID.slice(0,8) + '...' : '❌ MISSING');
  console.log('CLIENT_SECRET:', CLIENT_SECRET ? '****' : '❌ MISSING');
  console.log('TEST_PHONE:', TEST_PHONE);

  // 1. Auth
  console.log('\n[1] Fetching access token...');
  let token;
  try {
    const authRes = await axios.get(`${BASE}/auth/token`, {
      headers: { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET },
      validateStatus: false,
    });
    console.log('   Status:', authRes.status, '| Body:', JSON.stringify(authRes.data).slice(0, 200));
    token = authRes.data.token || authRes.data.data?.token;
    if (!token) throw new Error('No token in response');
    console.log('   ✅ Token OK:', token.slice(0, 20) + '...');
  } catch (e) {
    console.error('   ❌ Auth FAILED:', e.message);
    process.exit(1);
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // 2. OTP endpoint
  console.log('\n[2] Testing OTP endpoint: POST /collections/otp');
  try {
    const otpRes = await axios.post(`${BASE}/collections/otp`, 
      { phone: TEST_PHONE },
      { headers, validateStatus: false }
    );
    console.log('   Status:', otpRes.status);
    console.log('   Body  :', JSON.stringify(otpRes.data, null, 2));
    if (otpRes.status === 200) {
      console.log('   ✅ OTP dispatched! pinId:', otpRes.data?.data?.pinId);
    } else {
      console.log('   ❌ OTP FAILED');
    }
  } catch (e) {
    console.error('   ❌ OTP request threw:', e.message);
  }

  // 3. Collection without OTP (to see raw Eversend error)
  console.log('\n[3] Testing collection WITHOUT OTP: POST /collections/momo');
  try {
    const colRes = await axios.post(`${BASE}/collections/momo`, {
      phone: TEST_PHONE,
      amount: TEST_AMOUNT,
      currency: TEST_CURRENCY,
      country: TEST_COUNTRY,
      transactionRef: `DIAG-${Date.now()}`,
    }, { headers, validateStatus: false });
    console.log('   Status:', colRes.status);
    console.log('   Body  :', JSON.stringify(colRes.data, null, 2));
  } catch (e) {
    console.error('   ❌ Collection request threw:', e.message);
  }

  console.log('\n═══════════════════════════════════════\n');
})();
