export const fmt = (n) =>
  new Intl.NumberFormat('fr-CM', {
    style: 'currency',
    currency: 'XAF',
    maximumFractionDigits: 0,
  }).format(n ?? 0);

// Shared mobile-money provider list used in both subscribe and checkout flows.
export const MOBILE_MONEY_PROVIDERS = [
  { id: 'CM_MTNMOMO', label: 'MTN Mobile Money' },
  { id: 'CM_ORANGE', label: 'Orange Money' },
];
