/**
 * services/mesomb.service.js
 * Auradime — MeSomb Payment Service
 *
 * Wraps @hachther/mesomb for MTN MoMo & Orange Money collections.
 * Coverage: Cameroon (XAF), and other CEMAC countries.
 *
 * ENV vars required:
 *   MESOMB_APPLICATION_KEY  — from MeSomb Developer Dashboard
 *   MESOMB_ACCESS_KEY       — from MeSomb Developer Dashboard
 *   MESOMB_SECRET_KEY       — from MeSomb Developer Dashboard
 *   MESOMB_WEBHOOK_SECRET   — optional HMAC secret for webhook validation
 */

const crypto = require('crypto');

const APPLICATION_KEY = process.env.MESOMB_APPLICATION_KEY;
const ACCESS_KEY      = process.env.MESOMB_ACCESS_KEY;
const SECRET_KEY      = process.env.MESOMB_SECRET_KEY;
const MESOMB_BASE_URL = (process.env.MESOMB_BASE_URL || 'https://mesomb.hachther.com/api/v1.1').replace(/\/$/, '');
const ALGORITHM = 'HMAC-SHA1';
const SIGNATURE_MODE = (process.env.MESOMB_SIGNATURE_MODE || 'auto').toLowerCase();

const requireCredentials = () => {
  if (!APPLICATION_KEY || !ACCESS_KEY || !SECRET_KEY) {
    throw new Error('MeSomb credentials not configured. Set MESOMB_APPLICATION_KEY, MESOMB_ACCESS_KEY, and MESOMB_SECRET_KEY.');
  }
};

const sha1 = (value) => crypto.createHash('sha1').update(value).digest('hex');
const hmacSha1 = (value, key) => crypto.createHmac('sha1', key).update(value).digest('hex');

const compactJson = (body) => JSON.stringify(body || {});

const yyyymmdd = (date) => (
  `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(date.getUTCDate()).padStart(2, '0')}`
);

const legacyScopeDate = (date) => (
  `${date.getFullYear()}${date.getMonth()}${date.getDate()}`
);

const buildCanonicalQuery = (url) => {
  const entries = Array.from(url.searchParams.entries())
    .map(([key, value]) => [encodeURIComponent(key), encodeURIComponent(value)])
    .sort(([a], [b]) => a.localeCompare(b));
  return entries.map(([key, value]) => `${key}=${value}`).join('&');
};

const signRequest = ({ method, url, date, nonce, body = null, signedHeaders = {}, mode = 'docs' }) => {
  const parsed = new URL(url);
  const legacy = mode === 'legacy';
  const timestamp = legacy ? String(date.getTime()) : String(Math.floor(date.getTime() / 1000));
  const headers = {
    ...Object.fromEntries(
      Object.entries(signedHeaders).map(([key, value]) => [key.toLowerCase(), String(value).trim()])
    ),
    host: legacy ? `${parsed.protocol}//${parsed.host}` : parsed.host,
    'x-mesomb-date': timestamp,
    'x-mesomb-nonce': nonce,
  };

  const headerNames = Object.keys(headers).sort();
  const canonicalHeaders = headerNames.map((key) => `${key}:${headers[key]}`).join('\n');
  const canonicalRequest = [
    method.toUpperCase(),
    encodeURI(parsed.pathname),
    buildCanonicalQuery(parsed),
    canonicalHeaders,
    headerNames.join(';'),
    sha1(body ? compactJson(body) : '{}'),
  ].join('\n');

  const scope = `${legacy ? legacyScopeDate(date) : yyyymmdd(date)}/payment/mesomb_request`;
  const stringToSign = [
    ALGORITHM,
    timestamp,
    scope,
    sha1(canonicalRequest),
  ].join('\n');
  const signature = hmacSha1(stringToSign, SECRET_KEY);

  return {
    authorization: `${ALGORITHM} Credential=${ACCESS_KEY}/${scope}, SignedHeaders=${headerNames.join(';')}, Signature=${signature}`,
    timestamp,
  };
};

const parseMesombError = async (response) => {
  const text = await response.text();
  if (!text) return `MeSomb request failed with HTTP ${response.status}`;
  try {
    const data = JSON.parse(text);
    return data.detail || data.message || data.error || text;
  } catch {
    return text;
  }
};

const getSignatureModes = () => {
  if (SIGNATURE_MODE === 'legacy') return ['legacy'];
  if (SIGNATURE_MODE === 'docs') return ['docs'];
  return ['docs', 'legacy'];
};

const mesombRequest = async ({ method = 'GET', endpoint, body = null, mode = 'asynchronous', trxID = null, trxIdInBody = false }) => {
  requireCredentials();
  const requestBody = body && trxID && trxIdInBody ? { ...body, trxID: String(trxID) } : body;
  const url = `${MESOMB_BASE_URL}/${endpoint.replace(/^\/+/, '').replace(/\/+$/, '')}`;
  const signedHeaders = requestBody ? { 'content-type': 'application/json' } : {};
  const modes = getSignatureModes();
  let lastError = null;

  for (const signatureMode of modes) {
    const date = new Date();
    const nonce = crypto.randomBytes(16).toString('hex');
    const { authorization, timestamp } = signRequest({
      method,
      url,
      date,
      nonce,
      body: requestBody,
      signedHeaders,
      mode: signatureMode,
    });

    const headers = {
      'x-mesomb-date': timestamp,
      'x-mesomb-nonce': nonce,
      'X-MeSomb-OperationMode': mode,
      'X-MeSomb-Source': 'AuradimeBackend/1.0',
      'X-MeSomb-Application': APPLICATION_KEY,
      'Accept-Language': 'en',
      Authorization: authorization,
    };

    if (requestBody) headers['Content-Type'] = 'application/json';
    if (trxID && !trxIdInBody) headers['X-MeSomb-TrxID'] = String(trxID);

    const response = await fetch(url, {
      method,
      headers,
      body: requestBody ? compactJson(requestBody) : undefined,
    });

    if (response.status < 400) return response.json();

    lastError = await parseMesombError(response);
    if (!/bad signature|invalid signature|signature/i.test(lastError) || signatureMode === modes[modes.length - 1]) {
      throw new Error(lastError);
    }

    console.warn(`[MeSomb] ${signatureMode} signature rejected; retrying with ${modes[modes.indexOf(signatureMode) + 1]} mode.`);
  }

  throw new Error(lastError || 'MeSomb request failed.');
};

const withBalanceHelper = (application = {}) => {
  const balances = Array.isArray(application.balances) ? application.balances : [];
  return {
    ...application,
    getBalance(country = null, service = null) {
      return balances
        .filter((item) => !country || item.country === country)
        .filter((item) => !service || item.service === service)
        .reduce((sum, item) => sum + Number(item.value || 0), 0);
    },
  };
};

/**
 * Detect the network operator from a Cameroonian phone number.
 * MTN: 650-659, 670-679, 680-689
 * Orange: 690-699, 655-659, 620-629
 * @param {string} phone - raw phone number (any format)
 * @returns {'MTN'|'ORANGE'|null}
 */
const detectOperator = (phone) => {
  if (!phone) return null;
  // Normalize: strip leading +237, 237, or 0
  const digits = phone.replace(/\D/g, '').replace(/^237/, '').replace(/^0/, '');
  if (!digits || digits.length < 9) return null;

  const prefix3 = parseInt(digits.slice(0, 3), 10);
  const prefix2 = parseInt(digits.slice(0, 2), 10);

  // MTN Cameroon prefixes
  const mtnPrefixes = [650,651,652,653,654,670,671,672,673,674,675,676,677,678,679,680,681,682,683,684,685,686,687,688,689];
  if (mtnPrefixes.includes(prefix3)) return 'MTN';

  // Orange Cameroon prefixes
  const orangePrefixes = [690,691,692,693,694,695,696,697,698,699,655,656,657,658,659,620,621,622,623,624,625,626,627,628,629];
  if (orangePrefixes.includes(prefix3)) return 'ORANGE';

  // Fallback by 2-digit range
  if ([67,68].includes(prefix2)) return 'MTN';
  if ([69,65,62].includes(prefix2)) return 'ORANGE';

  return null;
};

/**
 * Normalize a phone number to the format MeSomb expects (e.g. 677550203 — no country code).
 */
const normalizePhone = (phone) => {
  if (!phone) return phone;
  return phone.replace(/\D/g, '').replace(/^237/, '').replace(/^0/, '');
};

/**
 * Initiate a mobile money collection via MeSomb.
 *
 * @param {Object} opts
 * @param {number}  opts.amount       - Amount in XAF
 * @param {string}  opts.phone        - Customer phone (any format)
 * @param {string}  [opts.service]    - Force 'MTN' or 'ORANGE' (auto-detected if omitted)
 * @param {string}  [opts.currency]   - ISO currency, defaults to 'XAF'
 * @param {string}  [opts.country]    - ISO country, defaults to 'CM'
 * @param {string}  [opts.trxID]      - Your internal reference (optional)
 * @param {string}  [opts.message]    - Custom notification message for the payer
 * @returns {Object} MeSomb response object
 */
const makeCollect = async ({
  amount,
  phone,
  service = null,
  currency = 'XAF',
  country = 'CM',
  trxID = null,
  message = 'Auradime Payment',
}) => {
  const normalizedPhone = normalizePhone(phone);
  const operator = service || detectOperator(normalizedPhone);

  if (!operator) {
    throw new Error(`Could not determine mobile operator for number: ${phone}. Please specify MTN or ORANGE.`);
  }

  const trx = trxID || crypto.randomBytes(16).toString('hex');

  const body = {
    amount: Math.round(amount),
    service: operator,
    payer: normalizedPhone,
    currency,
    country,
    amount_currency: currency,
    fees: true,
    conversion: false,
    message,
  };

  const response = await mesombRequest({
    method: 'POST',
    endpoint: 'payment/collect',
    body,
    mode: 'synchronous',
    trxID: trx,
    trxIdInBody: true,
  });

  console.log(`[MeSomb] Collection ${operator} ${normalizedPhone} — ${amount} ${currency}: ${response.status}`);

  return response;
};

/**
 * Send money from the Auradime MeSomb application balance to a receiver.
 * MeSomb calls this operation a deposit/disbursement.
 */
const makeDeposit = async ({
  amount,
  phone,
  service = null,
  currency = 'XAF',
  country = 'CM',
  trxID = null,
  message = 'Auradime Withdrawal',
  customer = {},
}) => {
  const normalizedPhone = normalizePhone(phone);
  const operator = service || detectOperator(normalizedPhone);

  if (!operator) {
    throw new Error(`Could not determine mobile operator for number: ${phone}. Please specify MTN or ORANGE.`);
  }

  const trx = trxID || crypto.randomBytes(16).toString('hex');

  const body = {
    amount: Math.round(amount),
    service: operator,
    receiver: normalizedPhone,
    currency,
    country,
    amount_currency: currency,
    conversion: false,
    message,
    customer,
  };

  return mesombRequest({
    method: 'POST',
    endpoint: 'payment/deposit',
    body,
    mode: 'asynchronous',
    trxID: trx,
    trxIdInBody: true,
  });
};

/**
 * Get the status of a MeSomb transaction.
 * @param {string} transactionId - MeSomb transaction ID or our trxID reference
 * @returns {Object} transaction data
 */
const getTransactionStatus = async (transactionId) => {
  const id = String(transactionId || '').trim();
  const source = id.startsWith('AURA-') ? 'EXTERNAL' : 'MESOMB';
  const response = await mesombRequest({
    method: 'GET',
    endpoint: `payment/transactions/check/?ids=${encodeURIComponent(id)}&source=${source}`,
  });
  return Array.isArray(response) ? response[0] : response;
};

const getApplicationStatus = async () => {
  const response = await mesombRequest({
    method: 'GET',
    endpoint: 'payment/status/',
  });
  return withBalanceHelper(response);
};

const getApplicationBalance = async ({ country = 'CM', service = null } = {}) => {
  const appStatus = await getApplicationStatus();
  if (!appStatus || typeof appStatus.getBalance !== 'function') return null;
  const serviceBalance = service ? Number(appStatus.getBalance(country, service)) : null;
  const countryBalance = Number(appStatus.getBalance(country));
  const balance = service && serviceBalance > 0 ? serviceBalance : countryBalance;
  return Number.isFinite(Number(balance)) ? Number(balance) : null;
};

/**
 * Map MeSomb response status to the platform standard.
 * @param {Object} response - Raw MeSomb response
 * @returns {'SUCCESSFUL'|'PENDING'|'FAILED'}
 */
const mapStatus = (response) => {
  if (!response) return 'FAILED';
  if (response.success === true || response.status === 'SUCCESS') return 'SUCCESSFUL';
  if (response.status === 'PENDING') return 'PENDING';
  return 'FAILED';
};

module.exports = {
  makeCollect,
  makeDeposit,
  getTransactionStatus,
  getApplicationStatus,
  getApplicationBalance,
  detectOperator,
  normalizePhone,
  mapStatus,
};
