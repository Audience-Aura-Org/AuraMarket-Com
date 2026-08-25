/**
 * services/payment/gateway.registry.js
 * Auradime — Payment Gateway Registry
 *
 * Active gateways: PayUnit, Wallet, Eversend, PawaPay
 *
 * To add a new gateway:
 *   1. Create `gateways/<name>.gateway.js` implementing the GatewayInterface
 *   2. Import it below and add to the GATEWAYS array
 *   3. Zero frontend changes needed — checkout UI reads this registry dynamically
 *
 * GatewayInterface:
 * {
 *   id: string,                            // stored in Transaction.gateway
 *   label: string,                         // human-readable name for UI
 *   description: string,                   // short subtitle
 *   icon: string,                          // emoji or URL
 *   currencies: string[],                  // [] = all currencies
 *   regions: string[],                     // [] = all regions
 *   fields: GatewayField[],                // dynamic form fields
 *   enabled: boolean,                      // feature flag
 *   initialize(ctx): Promise<InitResult>,
 *   verify(reference): Promise<VerifyResult>
 * }
 */

const walletGateway   = require('./gateways/wallet.gateway');
const payunitGateway  = require('./gateways/payunit.gateway');
const eversendGateway = require('./gateways/eversend.gateway');
const pawapayGateway  = require('./gateways/pawapay.gateway');
/** Ordered gateway list — first = shown first in checkout UI */
const GATEWAYS = [
  payunitGateway,   // Primary Cameroon mobile money gateway
  pawapayGateway,   // PawaPay mobile money (XAF — MTN/Orange Cameroon)
  walletGateway,    // Instant balance deduction, no external redirect
  eversendGateway,  // Multi-country mobile money (XAF, NGN, KES, UGX…)
  // require('./gateways/flutterwave.gateway'),
  // require('./gateways/campay.gateway'),
];

/**
 * Return all enabled gateways safe for client (no secrets), optionally filtered by currency.
 * @param {string|null} currency - ISO code e.g. 'XAF', or null for all
 */
const getAvailableGateways = (currency = null) => {
  return GATEWAYS.filter(gw => {
    if (!gw.enabled) return false;
    if (currency && gw.currencies.length > 0 && !gw.currencies.includes(currency)) return false;
    return true;
  }).map(gw => ({
    id:          gw.id,
    label:       gw.label,
    description: gw.description,
    icon:        gw.icon,
    currencies:  gw.currencies,
    regions:     gw.regions,
    fields:      gw.fields,
  }));
};

/**
 * Look up a gateway by ID. Throws if unknown or disabled.
 * @param {string} gatewayId
 * @returns full gateway object (with initialize / verify methods)
 */
const getGateway = (gatewayId) => {
  const gw = GATEWAYS.find(g => g.id === gatewayId);
  if (!gw)         throw new Error(`Unknown payment gateway: "${gatewayId}"`);
  if (!gw.enabled) throw new Error(`Payment gateway "${gatewayId}" is currently disabled.`);
  return gw;
};

module.exports = { getAvailableGateways, getGateway, GATEWAYS };
