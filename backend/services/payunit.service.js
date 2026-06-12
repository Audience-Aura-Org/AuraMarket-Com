const axios = require('axios');
const {
  PAYUNIT_API_USERNAME,
  PAYUNIT_API_PASSWORD,
  PAYUNIT_LIVE_KEY,
  PAYUNIT_SANDBOX_KEY,
  PAYUNIT_MODE,
  PAYUNIT_BASE_URL,
} = require('../config/env');

const DEFAULT_BASE_URL = 'https://gateway.payunit.net';

const getMode = () => (String(PAYUNIT_MODE || 'live').toLowerCase() === 'test' ? 'test' : 'live');

const getApiKey = () => {
  const mode = getMode();
  return mode === 'test' ? PAYUNIT_SANDBOX_KEY : PAYUNIT_LIVE_KEY;
};

const requireConfig = () => {
  const apiKey = getApiKey();
  if (!PAYUNIT_API_USERNAME || !PAYUNIT_API_PASSWORD || !apiKey) {
    throw new Error('PayUnit is not configured. Set PAYUNIT_API_USERNAME, PAYUNIT_API_PASSWORD, PAYUNIT_LIVE_KEY, and PAYUNIT_SANDBOX_KEY.');
  }
  return { apiKey, mode: getMode() };
};

const client = () => {
  const { apiKey, mode } = requireConfig();
  const auth = Buffer.from(`${PAYUNIT_API_USERNAME}:${PAYUNIT_API_PASSWORD}`).toString('base64');
  return axios.create({
    baseURL: PAYUNIT_BASE_URL || DEFAULT_BASE_URL,
    timeout: 25000,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${auth}`,
      'x-api-key': apiKey,
      mode,
    },
  });
};

const normalizePhone = (phone, country = 'CM') => {
  if (!phone) return '';
  let value = String(phone).replace(/[^\d+]/g, '');
  if (value.startsWith('00')) value = `+${value.slice(2)}`;
  if (!value.startsWith('+')) {
    const prefixes = { CM: '237' };
    const prefix = prefixes[country] || '237';
    if (value.startsWith('0')) value = value.slice(1);
    if (!value.startsWith(prefix)) value = `${prefix}${value}`;
    value = `+${value}`;
  }
  return value;
};

const cleanTransactionId = (value) =>
  String(value || '')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 64);

const parseData = (response) => response?.data?.data || response?.data || response;

const initializePayment = async ({
  amount,
  currency = 'XAF',
  transactionId,
  returnUrl,
  notifyUrl,
  country = 'CM',
}) => {
  const payload = {
    total_amount: Number(amount),
    currency,
    transaction_id: cleanTransactionId(transactionId),
    return_url: returnUrl,
    notify_url: notifyUrl,
    payment_country: country,
  };

  const res = await client().post('/api/gateway/initialize', payload);
  return { raw: res.data, data: parseData(res) };
};

const makeMobilePayment = async ({
  amount,
  currency = 'XAF',
  transactionId,
  returnUrl,
  notifyUrl,
  phone,
  provider = 'CM_MTNMOMO',
}) => {
  const payload = {
    gateway: provider,
    amount: Number(amount),
    transaction_id: cleanTransactionId(transactionId),
    return_url: returnUrl,
    notify_url: notifyUrl,
    phone_number: normalizePhone(phone).replace(/^\+/, ''),
    currency,
    paymentType: 'button',
  };

  const res = await client().post('/api/gateway/makepayment', payload);
  return { raw: res.data, data: parseData(res) };
};

const getPaymentStatus = async (transactionId) => {
  const res = await client().get(`/api/gateway/paymentstatus/${encodeURIComponent(cleanTransactionId(transactionId))}`);
  return { raw: res.data, data: parseData(res) };
};

const normalizeStatus = (payload) => {
  const status = String(payload?.transaction_status || payload?.payment_status || payload?.status || '').toUpperCase();
  if (status === 'SUCCESS' || status === 'SUCCESSFUL' || status === 'COMPLETED') return 'SUCCESSFUL';
  if (status === 'FAILED' || status === 'CANCELLED' || status === 'CANCELED') return 'FAILED';
  return 'PENDING';
};

module.exports = {
  initializePayment,
  makeMobilePayment,
  getPaymentStatus,
  normalizeStatus,
  normalizePhone,
  cleanTransactionId,
  getMode,
};
