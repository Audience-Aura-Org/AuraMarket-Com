const MOBILE_MONEY_COLLECTION_FEE_XAF = Math.max(
  0,
  Number(process.env.MOBILE_MONEY_COLLECTION_FEE_XAF || 5)
);

const MOBILE_MONEY_GATEWAYS = new Set(['eversend', 'payunit']);

const isMobileMoneyGateway = (gateway) =>
  MOBILE_MONEY_GATEWAYS.has(String(gateway || '').toLowerCase());

const getMobileMoneyCollectionFee = (gateway, currency = 'XAF') => {
  if (!isMobileMoneyGateway(gateway)) return 0;
  if (String(currency || 'XAF').toUpperCase() !== 'XAF') return 0;
  return MOBILE_MONEY_COLLECTION_FEE_XAF;
};

const applyMobileMoneyCollectionFee = (amount, gateway, currency = 'XAF') => {
  const netAmount = Math.max(0, Math.round(Number(amount || 0)));
  const collectionFee = getMobileMoneyCollectionFee(gateway, currency);
  return {
    netAmount,
    collectionFee,
    grossAmount: netAmount + collectionFee,
  };
};

module.exports = {
  MOBILE_MONEY_COLLECTION_FEE_XAF,
  applyMobileMoneyCollectionFee,
  getMobileMoneyCollectionFee,
  isMobileMoneyGateway,
};
