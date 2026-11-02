export const paymentMethodLabel = (gateway) => {
  const method = String(gateway || '').toLowerCase();
  if (['pawapay', 'payunit', 'eversend', 'momo'].includes(method)) return 'Mobile Money';
  if (method === 'wallet') return 'Wallet';
  return gateway || '';
};

export const paymentMessage = (message) => typeof message === 'string'
  ? message.replace(/pawapay|payunit|eversend/gi, 'Mobile Money')
  : message;
