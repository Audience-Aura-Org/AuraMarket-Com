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

const { PaymentOperation, RandomGenerator } = require('@hachther/mesomb');

const APPLICATION_KEY = process.env.MESOMB_APPLICATION_KEY;
const ACCESS_KEY      = process.env.MESOMB_ACCESS_KEY;
const SECRET_KEY      = process.env.MESOMB_SECRET_KEY;

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
  if (!APPLICATION_KEY || !ACCESS_KEY || !SECRET_KEY) {
    throw new Error('MeSomb credentials not configured. Set MESOMB_APPLICATION_KEY, MESOMB_ACCESS_KEY, and MESOMB_SECRET_KEY.');
  }

  const normalizedPhone = normalizePhone(phone);
  const operator = service || detectOperator(normalizedPhone);

  if (!operator) {
    throw new Error(`Could not determine mobile operator for number: ${phone}. Please specify MTN or ORANGE.`);
  }

  const client = new PaymentOperation({
    applicationKey: APPLICATION_KEY,
    accessKey: ACCESS_KEY,
    secretKey: SECRET_KEY,
  });

  const nonce = RandomGenerator.nonce();

  const response = await client.makeCollect({
    amount: Math.round(amount),
    service: operator,
    payer: normalizedPhone,
    nonce,
    trxID: trxID || nonce,
    currency,
    country,
    message,
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
  if (!APPLICATION_KEY || !ACCESS_KEY || !SECRET_KEY) {
    throw new Error('MeSomb credentials not configured. Set MESOMB_APPLICATION_KEY, MESOMB_ACCESS_KEY, and MESOMB_SECRET_KEY.');
  }

  const normalizedPhone = normalizePhone(phone);
  const operator = service || detectOperator(normalizedPhone);

  if (!operator) {
    throw new Error(`Could not determine mobile operator for number: ${phone}. Please specify MTN or ORANGE.`);
  }

  const client = new PaymentOperation({
    applicationKey: APPLICATION_KEY,
    accessKey: ACCESS_KEY,
    secretKey: SECRET_KEY,
  });

  const nonce = RandomGenerator.nonce();

  return client.makeDeposit({
    amount: Math.round(amount),
    service: operator,
    receiver: normalizedPhone,
    nonce,
    trxID: trxID || nonce,
    currency,
    country,
    message,
    customer,
  });
};

/**
 * Get the status of a MeSomb transaction.
 * @param {string} transactionId - MeSomb transaction ID or our trxID reference
 * @returns {Object} transaction data
 */
const getTransactionStatus = async (transactionId) => {
  if (!APPLICATION_KEY || !ACCESS_KEY || !SECRET_KEY) {
    throw new Error('MeSomb credentials not configured.');
  }

  const client = new PaymentOperation({
    applicationKey: APPLICATION_KEY,
    accessKey: ACCESS_KEY,
    secretKey: SECRET_KEY,
  });

  // MeSomb status can be checked by our trxID or their pk
  const response = await client.getStatus(transactionId);
  return response;
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
  detectOperator,
  normalizePhone,
  mapStatus,
};
