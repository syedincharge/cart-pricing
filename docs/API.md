# API

All money is integer cents. Nothing in this project accepts or returns floating
point dollars.

## `cart.js`

### `createCart()`

Returns a new empty cart: `{ items: [] }`.

```js
const cart = createCart();
```

### `addItem(cart, { sku, unitPriceCents, quantity })`

Adds a line to the cart and returns the cart. `quantity` defaults to `1`. Adding
a `sku` that is already in the cart increases that line's quantity instead of
adding a second line.

Throws `TypeError` if `sku` is not a non-empty string, and `RangeError` if
`unitPriceCents` is not a non-negative integer or `quantity` is not a positive
integer.

```js
addItem(cart, { sku: 'mug', unitPriceCents: 1250, quantity: 2 });
```

### `itemCount(cart)`

Returns the total number of units across all lines.

### `subtotal(cart)`

Returns the cart value in cents before any volume discount or coupon. This is the
raw line-item sum, regardless of how many units the cart holds.

### `total(cart, coupons = [])`

Returns the cart value in cents after applying the volume discount and then
`coupons` **in the order given**. The volume discount applies to the raw subtotal
first: at 10 units the cart gets 5% off, at 25 units 10% off. Each coupon then
applies to the running total left by the previous discount or coupon, so coupon
order changes the result. The total never drops below zero.

```js
total(cart, [percentOff('SAVE10', 10), amountOff('FIVER', 500)]);
```

## `discounts.js`

### `percentOff(code, percent)`

Returns a coupon taking `percent` off the running total. `percent` must be between
`0` and `100` inclusive, otherwise `RangeError`.

### `amountOff(code, cents)`

Returns a coupon taking a flat `cents` amount off the running total. `cents` must be
a non-negative integer, otherwise `RangeError`.

### `discountFor(subtotalCents, coupon)`

Returns how many cents `coupon` takes off `subtotalCents`, capped at the
value passed in. Throws `RangeError` for an unknown coupon kind.

### `volumeDiscountFor(subtotalCents, unitCount)`

Returns how many cents the volume discount takes off `subtotalCents` based on
the cart-wide unit count. The discount applies to the highest qualifying tier:
10–24 units gets 5% off, 25 or more units gets 10% off. Tiers do not stack; 25
units gets 10%, not 15%. Returns 0 if the cart holds fewer than 10 units. Never
returns more than `subtotalCents`.

```js
volumeDiscountFor(10000, 10);  // 500 (5% of 10000)
volumeDiscountFor(10000, 25);  // 1000 (10% of 10000)
volumeDiscountFor(10000, 9);   // 0 (below threshold)
```

## `money.js`

### `roundCents(cents)`

Rounds to a whole cent, half away from zero. Throws `TypeError` on a non-finite
input.

### `clampToZero(cents)`

Returns `0` for a negative amount, otherwise the amount unchanged.

### `formatCents(cents)`

Formats a cent amount for display: `1234` becomes `"$12.34"`, `-250` becomes
`"-$2.50"`.
