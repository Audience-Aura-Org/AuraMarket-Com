const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const { EVERSEND_CLIENT_ID, EVERSEND_CLIENT_SECRET, EVERSEND_BASE_URL } = process.env;

async function getLatestEversendTransactions() {
  try {
    const authRes = await axios.get(`${EVERSEND_BASE_URL}/auth/token`, {
      headers: { clientId: EVERSEND_CLIENT_ID, clientSecret: EVERSEND_CLIENT_SECRET },
    });
    const token = authRes.data?.token || authRes.data?.data?.token;

    const txRes = await axios.get(`${EVERSEND_BASE_URL}/transactions`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { limit: 5 }
    });

    const txs = txRes.data?.data?.transactions || [];
    console.log(`Latest ${txs.length} transactions from Eversend:`);
    txs.forEach(t => {
      console.log(`- ID: ${t.transactionId}, Ref: ${t.transactionRef}, Type: ${t.type}, Amount: ${t.amount} ${t.currency}, Status: ${t.status}, Created: ${t.createdAt}`);
    });

  } catch (err) {
    console.error('Error:', err.response?.data || err.message);
  }
}

getLatestEversendTransactions();
