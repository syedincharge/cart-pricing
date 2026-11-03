# DESIGN: tiered volume discounts

## Feature

The cart automatically discounts its subtotal based on how many units it
holds in total: 5% off once the cart reaches 10 units, 10% off once it
reaches 25. This is a structural pricing rule, not something a caller opts
into or a code a shopper enters — every call to `total()` reflects it, the
same way `subtotal()` always reflects the line items. It stacks with coupon
codes in a fixed, documented order so the result is predictable regardless
of which coupons are present.

## Approach

**Tier basis: cart-wide.** The threshold is `itemCount(cart)` — the sum of
`quantity` across every line — not any single line's quantity. A cart with
five mugs and five tees qualifies for the 10-unit tier; a cart with nine of
one sku does not, no matter its per-line quantity. This is the plain reading
of "10 units" in the request (a cart total, not a per-sku total), and it
reuses `itemCount`, which already exists for exactly this purpose.

**Tier semantics: highest tier only, not cumulative.** A cart qualifies for
the highest tier whose threshold it meets or exceeds, and only that tier's
percentage applies — tiers do not stack with each other. Boundaries are
inclusive of the threshold itself:

| `itemCount(cart)` | Discount |
|---|---|
| 0–9 | none |
| 10–24 | 5% |
| 25+ | 10% |

At exactly 10 units the cart gets 5%, not 0%. At exactly 25 it gets 10%, not
5%+10%=15% and not a jump straight from the 5% tier's rate. At 24 units it
is still 5%; adding one more unit is what crosses into 10%. This mirrors how
`discountFor` already treats a single coupon's percentage as a flat rate off
the base, not something that compounds with anything else.

**Precedence: volume discount first, coupons after, in the order given.**
The cart's bulk-pricing tier is applied to the raw subtotal first; each
coupon then discounts the running total left by the discount before it,
exactly as coupons already do today. One sentence of justification: the
volume tier is a property of the cart's contents alone (subtotal and unit
count), so computing it before any coupon keeps its cents value fixed and
independent of which coupon codes happen to be present, whereas computing it
last would make the bulk discount's size silently depend on the coupons —
conflating a merchandising rule with a promotional one.

Rejected alternative: coupons first, volume discount last. This produces a
smaller volume-discount amount whenever a coupon has already reduced the
running total, and that amount would vary by coupon choice even though nothing
about the cart's bulk composition changed — a harder rule to document or
verify by hand.

Rejected alternative: make tiers opt-in (a new parameter such as
`total(cart, coupons, { applyTiers: true })`, or a parallel function like
`totalWithVolumeDiscount`). This adds API surface and a footgun — a caller
who forgets the flag silently gets the wrong price — for a rule the request
frames as automatic, not chosen. `total(cart, coupons)` auto-applies tiers
with no new parameter; this is the same category of change as `subtotal()`
already being automatic.

**Worked example (canonical — use this in tests and docs).** Cart: one line,
`unitPriceCents: 1000`, `quantity: 10`. `subtotal = 10000`, `itemCount = 10`
→ 5% tier.

```
10000  subtotal
 -500  volume discount (5% of 10000, itemCount = 10)
 9500  running total after volume discount

coupons = [percentOff('SAVE10', 10), amountOff('FIVER', 500)]
 9500 -> -10%  (round(9500 * 0.10) = 950) -> 8550
 8550 -> -500                              -> 8050   <- total()

coupons = [amountOff('FIVER', 500), percentOff('SAVE10', 10)]
 9500 -> -500                              -> 9000
 9000 -> -10%  (round(9000 * 0.10) = 900)  -> 8100   <- total()
```

Second example, showing tiers are not cumulative: 25 units at 1000 cents
each. `subtotal = 25000`, `itemCount = 25` → 10% tier alone: discount =
`round(25000 * 0.10) = 2500`, running total = `22500`. (Not `25000 * 0.15 =
3750`; the 5% tier does not also apply.)

**Existing test expectation that becomes stale.** `test/cart.test.js`,
`describe('total')`, `it('applies coupons in the order given')` builds a cart
with `quantity: 10` at `unitPriceCents: 1000` — this now crosses the 10-unit
tier threshold, so the old expectations no longer hold:

| Assertion | Old expected | New expected |
|---|---|---|
| `total(cart, [percentOff('SAVE10', 10), amountOff('FIVER', 500)])` | `8500` | `8050` |
| `total(cart, [amountOff('FIVER', 500), percentOff('SAVE10', 10)])` | `8550` | `8100` |

The inline comments above each assertion (`// 10000 -> -10% -> 9000 -> ...`)
need the extra `-500 volume discount -> 9500` step added, per the worked
example above. This is the tester's file to update, not mine — flagging it
here so the change reads as intentional, not a regression.

The other two `total` tests are unaffected: `'equals the subtotal with no
coupons'` uses a 2-unit cart (below the 10-unit threshold), and `'floors at
zero'` uses a 1-unit cart — neither crosses a tier boundary.

## Changes

- **`src/discounts.js`** — add a private (non-exported) `VOLUME_TIERS`
  constant and an exported `volumeDiscountFor(subtotalCents, unitCount)`
  function that returns the cents the appropriate tier takes off. Sits
  alongside `discountFor`, same file, same style: derive a percentage,
  round it with `roundCents`, cap it at the subtotal and floor it at zero
  with `clampToZero`, same as `discountFor`'s `'percent'` branch.
- **`src/cart.js`** — import `volumeDiscountFor` and change `total()` to
  seed its coupon `reduce` with `subtotal(cart)` minus the volume discount,
  instead of the raw subtotal. No signature change.
- **`test/cart.test.js`** (tester's file, not edited here) — update the two
  stale expectations listed above, and add coverage per Test cases below.
- **`docs/API.md`** (doc-writer's file, not edited here) — needs a new entry
  for `volumeDiscountFor` under `discounts.js`, and the `total()` entry needs
  a sentence added noting it applies the volume tier before coupons. Also
  worth a note on `subtotal()`'s entry that it is deliberately *before* the
  volume discount too, not just before coupons.

## Public API

### `src/discounts.js`

```js
/**
 * Returns how many cents the volume discount takes off `subtotalCents` for a
 * cart holding `unitCount` units in total (cart-wide, summed across every
 * line — see itemCount). Applies the single highest tier `unitCount`
 * qualifies for; tiers do not stack. Returns 0 if `unitCount` is below the
 * lowest tier's threshold (10).
 */
export function volumeDiscountFor(subtotalCents, unitCount) {
  // ...
}
```

No new `TypeError`/`RangeError` are introduced by this function. It takes no
new caller-supplied domain object (unlike `discountFor`'s `coupon`) — both
arguments are plain numbers already guaranteed valid by the time `cart.js`
calls it (`subtotal()` and `itemCount()` are always non-negative integers
because `addItem` validates `unitPriceCents` and `quantity` at the boundary).
Following `discountFor`'s existing precedent — it doesn't validate its own
`subtotalCents` parameter either — `volumeDiscountFor` does not validate
`subtotalCents` or `unitCount`. Do not add checks here; that would be a
defensive check between internal functions, which the conventions rule out.

`VOLUME_TIERS` itself is not exported. It is an implementation detail;
nothing outside `discounts.js` needs to see the raw table, only the
resulting discount.

### `src/cart.js`

```js
export function total(cart, coupons = []) {
  // ...
}
```

Signature is unchanged. Behavior changes: the value returned now already
reflects the volume discount before any coupon is applied. `total(cart)`
with no coupons at all now returns `subtotal(cart)` minus the volume
discount, not the bare subtotal, whenever `itemCount(cart) >= 10`.

## Test cases

For `volumeDiscountFor(subtotalCents, unitCount)` directly:

- `unitCount` of 9 → 0, regardless of `subtotalCents`.
- `unitCount` of exactly 10 → 5% of `subtotalCents`.
- `unitCount` of 24 → still 5% (not yet 10%).
- `unitCount` of exactly 25 → 10% of `subtotalCents`, not 15% and not a
  second discount stacked on top of the 5% figure.
- `unitCount` of 1000 → still 10% (no tier above the top one).
- A `subtotalCents` value that produces a fractional cent at 5% (e.g. `1999`
  at `unitCount = 10`: `1999 * 0.05 = 99.95` → rounds to `100`) — confirms
  it reuses `roundCents`'s half-away-from-zero rule, same as `discountFor`'s
  existing rounding test.
- `unitCount = 0`, `subtotalCents = 0` → 0 (empty cart doesn't throw or
  divide oddly).

For `total(cart, coupons)`:

- Cart below 10 units, with and without coupons: totals match today's
  behavior exactly (no silent change below the threshold) — pins the two
  currently-unaffected `total` tests as regression coverage.
- Cart at exactly 10 units, no coupons: `total(cart) === subtotal - 5%`,
  matching the worked example (`9500` for the canonical cart).
- Cart at exactly 25 units, no coupons: `total(cart) === subtotal - 10%`,
  not `subtotal - 15%`.
- The canonical 10-unit-plus-two-coupon-orders example from the worked
  arithmetic above — both orders (`8050` and `8100`) — pinning that
  precedence is volume-then-coupons and that coupon order still matters for
  the coupon stage.
- A cart that crosses a tier boundary by exactly one unit (9 vs. 10, or 24
  vs. 25) with everything else held constant, to pin the discontinuity at
  the threshold rather than a gradual ramp.
- Volume discount plus a coupon large enough to floor the total at zero
  (e.g. a big flat `amountOff` on a small cart at the 10-unit tier) — still
  floors at 0, doesn't go negative.

## Out of scope

- Per-line or per-sku volume tiers. Only `itemCount(cart)` (cart-wide) is a
  tier basis; a line with a huge quantity of one sku does not get special
  treatment beyond its contribution to the cart-wide count.
- Caller-configurable tier tables or thresholds. `VOLUME_TIERS` is a fixed
  constant in `discounts.js`, not a parameter to any exported function.
- Caller-configurable precedence (e.g. a flag to run coupons before the
  volume tier). One fixed, documented order only.
- A cart-level function to introspect the volume discount amount on its own
  (separate from `total()`). `total(cart)` with an empty coupon list already
  exposes the post-volume-discount value.
- Any change to `subtotal()`'s behavior — it remains the raw line-item sum,
  unaffected by tiers or coupons.
