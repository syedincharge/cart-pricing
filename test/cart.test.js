import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { addItem, createCart, itemCount, subtotal, total } from '../src/cart.js';
import { amountOff, discountFor, percentOff, volumeDiscountFor } from '../src/discounts.js';
import { formatCents } from '../src/money.js';

describe('cart', () => {
  it('starts empty', () => {
    const cart = createCart();
    assert.equal(itemCount(cart), 0);
    assert.equal(subtotal(cart), 0);
  });

  it('sums line totals', () => {
    const cart = createCart();
    addItem(cart, { sku: 'mug', unitPriceCents: 1250, quantity: 2 });
    addItem(cart, { sku: 'tee', unitPriceCents: 1999 });
    assert.equal(subtotal(cart), 4499);
    assert.equal(itemCount(cart), 3);
  });

  it('merges a repeated sku into one line', () => {
    const cart = createCart();
    addItem(cart, { sku: 'mug', unitPriceCents: 1250, quantity: 2 });
    addItem(cart, { sku: 'mug', unitPriceCents: 1250, quantity: 3 });
    assert.equal(cart.items.length, 1);
    assert.equal(cart.items[0].quantity, 5);
  });

  it('rejects invalid lines', () => {
    const cart = createCart();
    assert.throws(() => addItem(cart, { sku: '', unitPriceCents: 100 }), TypeError);
    assert.throws(
      () => addItem(cart, { sku: 'mug', unitPriceCents: -1 }),
      RangeError,
    );
    assert.throws(
      () => addItem(cart, { sku: 'mug', unitPriceCents: 100, quantity: 0 }),
      RangeError,
    );
  });
});

describe('coupons', () => {
  it('takes a percentage off the subtotal', () => {
    assert.equal(discountFor(4000, percentOff('SAVE10', 10)), 400);
  });

  it('rounds a fractional percentage to the nearest cent', () => {
    assert.equal(discountFor(1999, percentOff('SAVE10', 10)), 200);
  });

  it('takes a flat amount off the subtotal', () => {
    assert.equal(discountFor(4000, amountOff('FIVER', 500)), 500);
  });

  it('never discounts more than the subtotal', () => {
    assert.equal(discountFor(300, amountOff('FIVER', 500)), 300);
  });

  it('rejects out-of-range coupons', () => {
    assert.throws(() => percentOff('SAVE', 101), RangeError);
    assert.throws(() => amountOff('FIVER', -1), RangeError);
    assert.throws(() => discountFor(100, { code: 'X', kind: 'bogus' }), RangeError);
  });
});

describe('volumeDiscountFor', () => {
  it('applies no discount below the lowest tier', () => {
    assert.equal(volumeDiscountFor(100000, 9), 0);
  });

  it('applies the 5% tier at exactly 10 units', () => {
    assert.equal(volumeDiscountFor(10000, 10), 500);
  });

  it('stays at 5% at 24 units, just short of the next tier', () => {
    assert.equal(volumeDiscountFor(24000, 24), 1200);
  });

  it('applies the 10% tier at exactly 25 units, not a cumulative 15%', () => {
    assert.equal(volumeDiscountFor(25000, 25), 2500);
  });

  it('stays at 10% for unit counts far past the top tier', () => {
    assert.equal(volumeDiscountFor(100000, 1000), 10000);
  });

  it('rounds a fractional percentage to the nearest cent, half away from zero', () => {
    assert.equal(volumeDiscountFor(1999, 10), 100);
  });

  it('returns 0 for an empty cart', () => {
    assert.equal(volumeDiscountFor(0, 0), 0);
  });
});

describe('total', () => {
  it('equals the subtotal with no coupons', () => {
    const cart = createCart();
    addItem(cart, { sku: 'mug', unitPriceCents: 1250, quantity: 2 });
    assert.equal(total(cart), 2500);
  });

  it('applies coupons in the order given', () => {
    const cart = createCart();
    addItem(cart, { sku: 'mug', unitPriceCents: 1000, quantity: 10 });
    // 10000 -> -500 volume discount (5%, itemCount = 10) -> 9500
    // 9500 -> -10% -> 8550 -> -$5.00 -> 8050
    assert.equal(total(cart, [percentOff('SAVE10', 10), amountOff('FIVER', 500)]), 8050);
    // 10000 -> -500 volume discount (5%, itemCount = 10) -> 9500
    // 9500 -> -$5.00 -> 9000 -> -10% -> 8100
    assert.equal(total(cart, [amountOff('FIVER', 500), percentOff('SAVE10', 10)]), 8100);
  });

  it('floors at zero', () => {
    const cart = createCart();
    addItem(cart, { sku: 'pin', unitPriceCents: 300 });
    assert.equal(total(cart, [amountOff('TENNER', 1000)]), 0);
  });

  it('stays at the plain subtotal one unit below the volume-discount threshold', () => {
    const cart = createCart();
    addItem(cart, { sku: 'mug', unitPriceCents: 1000, quantity: 9 });
    assert.equal(total(cart), 9000);
  });

  it('applies the volume discount alone at exactly the 10-unit threshold', () => {
    const cart = createCart();
    addItem(cart, { sku: 'mug', unitPriceCents: 1000, quantity: 10 });
    // 10000 -> -500 (5% of 10000, itemCount = 10) -> 9500
    assert.equal(total(cart), 9500);
  });

  it('stays at the 5% tier at 24 units, one short of the next tier', () => {
    const cart = createCart();
    addItem(cart, { sku: 'mug', unitPriceCents: 1000, quantity: 24 });
    // 24000 -> -1200 (5% of 24000, itemCount = 24) -> 22800
    assert.equal(total(cart), 22800);
  });

  it('jumps to the 10% tier at exactly 25 units, not a cumulative 15%', () => {
    const cart = createCart();
    addItem(cart, { sku: 'mug', unitPriceCents: 1000, quantity: 25 });
    // 25000 -> -2500 (10% of 25000, itemCount = 25) -> 22500, not 25000 * 0.15
    assert.equal(total(cart), 22500);
  });

  it('reaches the tier from units summed across lines, not one line alone', () => {
    const cart = createCart();
    addItem(cart, { sku: 'mug', unitPriceCents: 1200, quantity: 5 });
    addItem(cart, { sku: 'tee', unitPriceCents: 800, quantity: 5 });
    // subtotal 10000, itemCount 10 (5 + 5) -> -500 (5%) -> 9500
    assert.equal(total(cart), 9500);
  });

  it('floors at zero even after the volume discount reduces the running total first', () => {
    const cart = createCart();
    addItem(cart, { sku: 'pin', unitPriceCents: 100, quantity: 10 });
    // 1000 -> -50 volume discount (5%, itemCount = 10) -> 950 -> -2000 coupon -> 0
    assert.equal(total(cart, [amountOff('BIG', 2000)]), 0);
  });
});

describe('formatCents', () => {
  it('formats whole and partial dollars', () => {
    assert.equal(formatCents(0), '$0.00');
    assert.equal(formatCents(5), '$0.05');
    assert.equal(formatCents(1234), '$12.34');
    assert.equal(formatCents(-250), '-$2.50');
  });
});
