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

Returns the cart value in cents before any coupon. This is the raw line-item sum.

### `total(cart, coupons = [])`

Returns the cart value in cents after applying `coupons` **in the order given**.
Each coupon applies to the running total left by the previous one, so coupon
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

## `money.js`

### `roundCents(cents)`

Rounds to a whole cent, half away from zero. Throws `TypeError` on a non-finite
input.

### `clampToZero(cents)`

Returns `0` for a negative amount, otherwise the amount unchanged.

### `formatCents(cents)`

Formats a cent amount for display: `1234` becomes `"$12.34"`, `-250` becomes
`"-$2.50"`.
