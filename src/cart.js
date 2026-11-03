import { discountFor } from './discounts.js';
import { clampToZero } from './money.js';

/** Creates an empty cart. */
export function createCart() {
  return { items: [] };
}

/**
 * Adds a line to the cart. Adding a sku that is already present increases the
 * quantity of the existing line rather than creating a second one.
 */
export function addItem(cart, { sku, unitPriceCents, quantity = 1 }) {
  if (typeof sku !== 'string' || sku.length === 0) {
    throw new TypeError('sku must be a non-empty string');
  }
  if (!Number.isInteger(unitPriceCents) || unitPriceCents < 0) {
    throw new RangeError('unitPriceCents must be a non-negative integer');
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new RangeError('quantity must be a positive integer');
  }

  const existing = cart.items.find((item) => item.sku === sku);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.items.push({ sku, unitPriceCents, quantity });
  }
  return cart;
}

/** Total number of units in the cart, across all lines. */
export function itemCount(cart) {
  return cart.items.reduce((count, item) => count + item.quantity, 0);
}

/** Cart value in cents before any coupon is applied. */
export function subtotal(cart) {
  return cart.items.reduce(
    (sum, item) => sum + item.unitPriceCents * item.quantity,
    0,
  );
}

/**
 * Cart value in cents after applying `coupons`, in the order given. Each
 * coupon applies to the running total left by the coupon before it.
 */
export function total(cart, coupons = []) {
  return coupons.reduce(
    (running, coupon) => clampToZero(running - discountFor(running, coupon)),
    subtotal(cart),
  );
}
