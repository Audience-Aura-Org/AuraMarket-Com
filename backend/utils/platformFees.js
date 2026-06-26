const FEE_TYPES = ['percentage', 'amount'];

const toNonNegativeNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : fallback;
};

const normalizeFeeType = (type) => (
  FEE_TYPES.includes(type) ? type : 'percentage'
);

const clampToBase = (value, baseAmount) => {
  const base = toNonNegativeNumber(baseAmount);
  return Math.min(toNonNegativeNumber(value), base);
};

const calculateFee = (baseAmount, type, value) => {
  const base = toNonNegativeNumber(baseAmount);
  const normalizedType = normalizeFeeType(type);
  const normalizedValue = toNonNegativeNumber(value);

  if (normalizedType === 'amount') {
    return clampToBase(normalizedValue, base);
  }

  return clampToBase((base * normalizedValue) / 100, base);
};

const getCommissionValue = (settings = {}) => {
  if (settings.commission_value !== undefined && settings.commission_value !== null) {
    return toNonNegativeNumber(settings.commission_value);
  }

  return toNonNegativeNumber(settings.commission_rate);
};

const calculateCommissionFee = (baseAmount, settings = {}) => (
  calculateFee(baseAmount, settings.commission_type, getCommissionValue(settings))
);

const calculateEscrowFee = (baseAmount, settings = {}) => (
  calculateFee(baseAmount, settings.escrow_fee_type, settings.escrow_fee_value)
);

const calculatePlatformFees = (baseAmount, settings = {}, { includeEscrowFee = false } = {}) => {
  const base = toNonNegativeNumber(baseAmount);
  const commissionFee = calculateCommissionFee(base, settings);
  const escrowFee = includeEscrowFee ? calculateEscrowFee(base, settings) : 0;
  const platformFee = clampToBase(commissionFee + escrowFee, base);

  return {
    commissionFee: Math.min(commissionFee, platformFee),
    escrowFee: Math.max(platformFee - commissionFee, 0),
    platformFee,
    vendorPayout: base - platformFee
  };
};

const describeFee = (settings = {}, { includeEscrowFee = false } = {}) => {
  const parts = [];
  const commissionValue = getCommissionValue(settings);

  if (commissionValue > 0) {
    const suffix = normalizeFeeType(settings.commission_type) === 'percentage' ? '%' : ' XAF';
    parts.push(`commission ${commissionValue}${suffix}`);
  }

  if (includeEscrowFee && toNonNegativeNumber(settings.escrow_fee_value) > 0) {
    const suffix = normalizeFeeType(settings.escrow_fee_type) === 'percentage' ? '%' : ' XAF';
    parts.push(`escrow fee ${settings.escrow_fee_value}${suffix}`);
  }

  return parts.length ? parts.join(' + ') : 'no platform fee';
};

const applyCommissionOverride = (settings = {}, commissionRate) => {
  if (commissionRate === undefined || commissionRate === null || commissionRate === '') {
    return settings;
  }

  const rate = Number(commissionRate);
  if (!Number.isFinite(rate) || rate < 0) return settings;

  const effectiveSettings = settings.toObject ? settings.toObject() : { ...settings };
  effectiveSettings.commission_type = 'percentage';
  effectiveSettings.commission_value = rate;
  effectiveSettings.commission_rate = rate;
  return effectiveSettings;
};

module.exports = {
  applyCommissionOverride,
  calculateFee,
  calculateCommissionFee,
  calculateEscrowFee,
  calculatePlatformFees,
  describeFee,
  getCommissionValue,
  normalizeFeeType,
  toNonNegativeNumber
};
