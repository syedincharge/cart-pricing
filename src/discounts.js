import { clampToZero, roundCents } from './money.js';

/**
 * A coupon is a plain object with a `code` and a `kind`. Only whole-cart
 * coupons exist today: percent off the subtotal, or a flat amount off.
 */

/** Builds a coupon that takes `percent` off the cart subtotal. */
export function percentOff(code, percent) {
  if (typeof code !== 'string' || code.length === 0) {
    throw new TypeError('code must be a non-empty string');
  }
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new RangeError('percent must be between 0 and 100');
  }
  return { code, kind: 'percent', percent };
}

/** Builds a coupon that takes a flat `cents` amount off the cart subtotal. */
export function amountOff(code, cents) {
  if (typeof code !== 'string' || code.length === 0) {
    throw new TypeError('code must be a non-empty string');
  }
  if (!Number.isInteger(cents) || cents < 0) {
    throw new RangeError('cents must be a non-negative integer');
  }
  return { code, kind: 'amount', cents };
}

/**
 * Returns how many cents `coupon` takes off `subtotalCents`. Never returns
 * more than the subtotal, so a coupon cannot make a cart worth negative money.
 */
export function discountFor(subtotalCents, coupon) {
  if (!coupon || typeof coupon !== 'object') {
    throw new TypeError('coupon must be an object');
  }

  switch (coupon.kind) {
    case 'percent':
      return clampToZero(
        Math.min(subtotalCents, roundCents((subtotalCents * coupon.percent) / 100)),
      );
    case 'amount':
      return clampToZero(Math.min(subtotalCents, coupon.cents));
    default:
      throw new RangeError(`unknown coupon kind: ${coupon.kind}`);
  }
}

/**
 * Ordered highest threshold first, so the first tier a cart qualifies for is
 * the only one that applies.
 */
const VOLUME_TIERS = [
  { minUnits: 25, percent: 10 },
  { minUnits: 10, percent: 5 },
];

/**
 * Returns how many cents the volume discount takes off `subtotalCents` for a
 * cart holding `unitCount` units in total (cart-wide, summed across every
 * line — see itemCount). Applies the single highest tier `unitCount`
 * qualifies for; tiers do not stack. Returns 0 if `unitCount` is below the
 * lowest tier's threshold (10).
 */
export function volumeDiscountFor(subtotalCents, unitCount) {
  const tier = VOLUME_TIERS.find((candidate) => unitCount >= candidate.minUnits);
  if (!tier) {
    return 0;
  }
  return clampToZero(
    Math.min(subtotalCents, roundCents((subtotalCents * tier.percent) / 100)),
  );
}
