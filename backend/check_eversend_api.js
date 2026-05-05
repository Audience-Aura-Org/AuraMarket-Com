const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const { EVERSEND_CLIENT_ID, EVERSEND_CLIENT_SECRET, EVERSEND_BASE_URL } = process.env;

async function getEversendTransactions() {
  try {
    console.log('Fetching Eversend Auth Token...');
    const authRes = await axios.get(`${EVERSEND_BASE_URL}/auth/token`, {
      headers: {
        clientId: EVERSEND_CLIENT_ID,
        clientSecret: EVERSEND_CLIENT_SECRET,
      },
    });

    const token = authRes.data?.token || authRes.data?.data?.token;
    if (!token) throw new Error('Failed to get token');

    console.log('Fetching Transactions from Eversend...');
    const txRes = await axios.get(`${EVERSEND_BASE_URL}/transactions`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      params: {
        limit: 10
      }
    });

    console.log('Eversend Raw Response Keys:', Object.keys(txRes.data));
    const data = txRes.data;
    const txs = data.data || data.transactions || (Array.isArray(data) ? data : []);
    
    console.log(`Found ${txs.length} transactions in Eversend gateway:`);
    txs.forEach(t => {
      console.log(`- ID: ${t.id}, Type: ${t.type}, Amount: ${t.amount} ${t.currency}, Status: ${t.status}, Created: ${t.createdAt}`);
    });

    if (txs.length === 0) {
      console.log('Full Response Body:', JSON.stringify(data, null, 2));
    }

  } catch (err) {
    console.error('Error:', err.response?.data || err.message);
  }
}

getEversendTransactions();
