require('dotenv').config();
const { getAccessToken, initiateCollection } = require('../services/eversend.service');
const { eversendInitialize } = require('../controllers/payment.controller');

async function runProductionTest() {
  console.log('🚀 Starting Eversend Production Integration Test...');
  
  // 1. Test Authentication
  try {
    console.log('\n--- 🔐 Testing Authentication ---');
    const token = await getAccessToken();
    console.log('✅ Access Token retrieved successfully.');
    console.log('Token (truncated):', token.substring(0, 20) + '...');
  } catch (err) {
    console.error('❌ Authentication Failed:', err.response?.data || err.message);
    process.exit(1);
  }

  // 2. Test Multi-Country Collection Initiation (KES - Kenya)
  // We use a small amount for testing. Note: This might actually trigger a push on the test number if valid.
  try {
    console.log('\n--- 🇰🇪 Testing Kenya (KES) Initiation ---');
    const res = await initiateCollection({
      amount: 1, // 1 KES
      currency: 'KES',
      phone: '+254700000000', // Mock/Test number
      country: 'KE',
      transactionRef: `PROD-TEST-KE-${Date.now()}`,
      firstName: 'Aura',
      lastName: 'Tester',
      email: 'tester@aura-market-com.vercel.app'
    });
    console.log('✅ Kenya Initiation Result:', JSON.stringify(res, null, 2));
  } catch (err) {
    console.error('❌ Kenya Initiation Failed:', err.response?.data || err.message);
  }

  // 3. Test Ghana (GHS) - Requires redirectUrl
  try {
    console.log('\n--- 🇬🇭 Testing Ghana (GHS) Initiation ---');
    const res = await initiateCollection({
      amount: 1, // 1 GHS
      currency: 'GHS',
      phone: '+233200000000', // Mock/Test number
      country: 'GH',
      transactionRef: `PROD-TEST-GH-${Date.now()}`,
      redirectUrl: 'https://aura-market-com.vercel.app/wallet/verify',
      firstName: 'Aura',
      lastName: 'Tester'
    });
    console.log('✅ Ghana Initiation Result:', JSON.stringify(res, null, 2));
  } catch (err) {
    console.error('❌ Ghana Initiation Failed:', err.response?.data || err.message);
  }

  console.log('\n--- 🏁 Test Sequence Complete ---');
}

runProductionTest();
