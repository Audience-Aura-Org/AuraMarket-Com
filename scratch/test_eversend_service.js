const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const eversend = require('../backend/services/eversend.service');

async function test() {
  try {
    console.log('Testing Eversend getTransactions via service...');
    const result = await eversend.getTransactions({ limit: 5 });
    console.log('Success!', result);
  } catch (err) {
    console.error('Test Failed:', err.response?.status, err.response?.data || err.message);
  }
}

test();
