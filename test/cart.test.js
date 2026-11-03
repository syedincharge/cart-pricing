import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { addItem, createCart, itemCount, subtotal, total } from '../src/cart.js';
import { amountOff, discountFor, percentOff } from '../src/discounts.js';
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

describe('total', () => {
  it('equals the subtotal with no coupons', () => {
    const cart = createCart();
    addItem(cart, { sku: 'mug', unitPriceCents: 1250, quantity: 2 });
    assert.equal(total(cart), 2500);
  });

  it('applies coupons in the order given', () => {
    const cart = createCart();
    addItem(cart, { sku: 'mug', unitPriceCents: 1000, quantity: 10 });
    // 10000 -> -10% -> 9000 -> -$5.00 -> 8500
    assert.equal(total(cart, [percentOff('SAVE10', 10), amountOff('FIVER', 500)]), 8500);
    // 10000 -> -$5.00 -> 9500 -> -10% -> 8550
    assert.equal(total(cart, [amountOff('FIVER', 500), percentOff('SAVE10', 10)]), 8550);
  });

  it('floors at zero', () => {
    const cart = createCart();
    addItem(cart, { sku: 'pin', unitPriceCents: 300 });
    assert.equal(total(cart, [amountOff('TENNER', 1000)]), 0);
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
