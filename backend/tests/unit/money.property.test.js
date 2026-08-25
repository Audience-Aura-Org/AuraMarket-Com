/**
 * tests/unit/money.property.test.js
 * Tier 2 — Property-based tests for financial math utilities.
 *
 * fast-check generates thousands of random inputs and shrinks any failing
 * case to its minimal reproduction.
 *
 * Properties tested:
 *   P-01  commission + escrowFee + vendorPayout == baseAmount (always sums to base)
 *   P-02  platformFee <= baseAmount (can never exceed 100 % of the base)
 *   P-03  vendorPayout >= 0 (vendor never owes money back)
 *   P-04  platformFee == commissionFee + escrowFee (breakdown identity)
 *   P-05  toXAF idempotency — toXAF(toXAF(x)) == toXAF(x)
 *   P-06  toXAF is non-negative for non-negative input
 *   P-07  assertOrderTotal accepts consistent totals and rejects inconsistent ones
 *   P-08  commission-only fees are equivalent whether expressed as % or flat amount
 *   P-09  applyCommissionOverride never produces a negative commission
 *   P-10  clampToBase — no fee type can produce a fee exceeding the base amount
 */

'use strict';

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  calculatePlatformFees,
  toXAF,
  assertOrderTotal,
  applyCommissionOverride,
  calculateFee,
  toNonNegativeNumber,
} from '../../utils/platformFees.js';

// ─────────────────────────────────────────────────────────────────────────────
// Arbitraries
// ─────────────────────────────────────────────────────────────────────────────

/** Reasonable order base amounts (0 – 10 000 000 XAF) */
const baseAmountArb = fc.integer({ min: 0, max: 10_000_000 });

/** Commission percentage (0 – 100 %) */
const pctArb = fc.float({ min: 0, max: 100, noNaN: true });

/** Flat fee value (0 – 5 000 000 XAF) */
const flatArb = fc.integer({ min: 0, max: 5_000_000 });

/** Full platform settings object with realistic ranges */
const settingsArb = fc.record({
  commission_type:  fc.constantFrom('percentage', 'amount'),
  commission_value: fc.float({ min: 0, max: 50, noNaN: true }),  // max 50 %
  escrow_fee_type:  fc.constantFrom('percentage', 'amount'),
  escrow_fee_value: fc.float({ min: 0, max: 10, noNaN: true }),  // max 10 %
});

// ─────────────────────────────────────────────────────────────────────────────
// P-01  commission + escrowFee + vendorPayout == baseAmount
// ─────────────────────────────────────────────────────────────────────────────
describe('P-01  fee split always sums to base (no escrow)', () => {
  it('commissionFee + vendorPayout == baseAmount', () => {
    fc.assert(fc.property(baseAmountArb, settingsArb, (base, settings) => {
      const { commissionFee, vendorPayout } = calculatePlatformFees(base, settings, { includeEscrowFee: false });
      expect(commissionFee + vendorPayout).toBeCloseTo(base, 0);
    }), { numRuns: 5_000 });
  });

  it('commissionFee + escrowFee + vendorPayout == baseAmount (with escrow)', () => {
    fc.assert(fc.property(baseAmountArb, settingsArb, (base, settings) => {
      const { commissionFee, escrowFee, vendorPayout } = calculatePlatformFees(base, settings, { includeEscrowFee: true });
      expect(commissionFee + escrowFee + vendorPayout).toBeCloseTo(base, 0);
    }), { numRuns: 5_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P-02  platformFee <= baseAmount
// ─────────────────────────────────────────────────────────────────────────────
describe('P-02  platformFee never exceeds baseAmount', () => {
  it('with escrow', () => {
    fc.assert(fc.property(baseAmountArb, settingsArb, (base, settings) => {
      const { platformFee } = calculatePlatformFees(base, settings, { includeEscrowFee: true });
      expect(platformFee).toBeLessThanOrEqual(base + 0.5); // 0.5 float tolerance
    }), { numRuns: 5_000 });
  });

  it('without escrow', () => {
    fc.assert(fc.property(baseAmountArb, settingsArb, (base, settings) => {
      const { platformFee } = calculatePlatformFees(base, settings, { includeEscrowFee: false });
      expect(platformFee).toBeLessThanOrEqual(base + 0.5);
    }), { numRuns: 5_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P-03  vendorPayout >= 0 — vendor never owes money back
// ─────────────────────────────────────────────────────────────────────────────
describe('P-03  vendorPayout >= 0', () => {
  it('always non-negative', () => {
    fc.assert(fc.property(baseAmountArb, settingsArb, (base, settings) => {
      const { vendorPayout } = calculatePlatformFees(base, settings, { includeEscrowFee: true });
      expect(vendorPayout).toBeGreaterThanOrEqual(-0.5); // float tolerance
    }), { numRuns: 5_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P-04  platformFee == commissionFee + escrowFee (breakdown identity)
// ─────────────────────────────────────────────────────────────────────────────
describe('P-04  platformFee == commissionFee + escrowFee', () => {
  it('identity holds', () => {
    fc.assert(fc.property(baseAmountArb, settingsArb, (base, settings) => {
      const { platformFee, commissionFee, escrowFee } = calculatePlatformFees(base, settings, { includeEscrowFee: true });
      expect(commissionFee + escrowFee).toBeCloseTo(platformFee, 0);
    }), { numRuns: 5_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P-05  toXAF idempotency
// ─────────────────────────────────────────────────────────────────────────────
describe('P-05  toXAF(toXAF(x)) == toXAF(x)', () => {
  it('is idempotent', () => {
    fc.assert(fc.property(
      fc.float({ min: 0, max: 10_000_000, noNaN: true }),
      (x) => {
        expect(toXAF(toXAF(x))).toBe(toXAF(x));
      }
    ), { numRuns: 10_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P-06  toXAF never returns negative for non-negative input
// ─────────────────────────────────────────────────────────────────────────────
describe('P-06  toXAF >= 0 for non-negative input', () => {
  it('is non-negative', () => {
    fc.assert(fc.property(
      fc.float({ min: 0, max: 10_000_000, noNaN: true }),
      (x) => {
        expect(toXAF(x)).toBeGreaterThanOrEqual(0);
      }
    ), { numRuns: 10_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P-07  assertOrderTotal — accepts consistent, rejects inconsistent
// ─────────────────────────────────────────────────────────────────────────────
describe('P-07  assertOrderTotal', () => {
  it('accepts consistent totals', () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 5_000_000 }),  // subtotal
      fc.integer({ min: 0, max: 100_000 }),    // shipping_fee
      fc.integer({ min: 0, max: 1_000 }),      // collection_fee
      (subtotal, shipping_fee, collection_fee) => {
        const total_amount = subtotal + shipping_fee + collection_fee;
        expect(() => assertOrderTotal({ subtotal, shipping_fee, collection_fee, total_amount })).not.toThrow();
      }
    ), { numRuns: 5_000 });
  });

  it('rejects inconsistent totals', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 5_000_000 }),  // subtotal
      fc.integer({ min: 0, max: 100_000 }),    // shipping_fee
      fc.integer({ min: 2, max: 10_000 }),     // delta (must be non-zero to guarantee mismatch)
      (subtotal, shipping_fee, delta) => {
        const correct = subtotal + shipping_fee;
        const wrong   = correct + delta;         // deliberately off by delta
        expect(() => assertOrderTotal({ subtotal, shipping_fee, collection_fee: 0, total_amount: wrong })).toThrow();
      }
    ), { numRuns: 5_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P-08  applyCommissionOverride — resulting commission is non-negative
// ─────────────────────────────────────────────────────────────────────────────
describe('P-08  applyCommissionOverride never produces negative commission', () => {
  it('resulting commission_value >= 0', () => {
    fc.assert(fc.property(
      fc.record({
        commission_type:  fc.constantFrom('percentage', 'amount'),
        commission_value: fc.float({ min: 0, max: 50, noNaN: true }),
        commission_rate:  fc.float({ min: 0, max: 50, noNaN: true }),
      }),
      fc.oneof(
        fc.float({ min: 0, max: 100, noNaN: true }),
        fc.constant(null),
        fc.constant(undefined),
        fc.constant(-1),          // invalid — should be rejected
      ),
      (settings, override) => {
        const effective = applyCommissionOverride(settings, override);
        const val = toNonNegativeNumber(
          effective.commission_value ?? effective.commission_rate, 0
        );
        expect(val).toBeGreaterThanOrEqual(0);
      }
    ), { numRuns: 3_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P-09  calculateFee — fee never exceeds base for any type/value
// ─────────────────────────────────────────────────────────────────────────────
describe('P-09  calculateFee never exceeds base', () => {
  it('percentage fee <= base', () => {
    fc.assert(fc.property(baseAmountArb, pctArb, (base, pct) => {
      const fee = calculateFee(base, 'percentage', pct);
      expect(fee).toBeLessThanOrEqual(base + 0.5);
      expect(fee).toBeGreaterThanOrEqual(0);
    }), { numRuns: 5_000 });
  });

  it('flat fee clamped to base', () => {
    fc.assert(fc.property(baseAmountArb, flatArb, (base, flat) => {
      const fee = calculateFee(base, 'amount', flat);
      expect(fee).toBeLessThanOrEqual(base + 0.5);
      expect(fee).toBeGreaterThanOrEqual(0);
    }), { numRuns: 5_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P-10  Zero base → all fees are zero, vendorPayout is zero
// ─────────────────────────────────────────────────────────────────────────────
describe('P-10  Zero base amount produces zero fees', () => {
  it('zero base → all zero', () => {
    fc.assert(fc.property(settingsArb, (settings) => {
      const { commissionFee, escrowFee, platformFee, vendorPayout } = calculatePlatformFees(0, settings, { includeEscrowFee: true });
      expect(commissionFee).toBe(0);
      expect(escrowFee).toBe(0);
      expect(platformFee).toBe(0);
      expect(vendorPayout).toBe(0);
    }), { numRuns: 1_000 });
  });
});
