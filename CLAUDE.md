# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

**cart-pricing** — a small cart pricing engine. It exists to demonstrate an
orchestrator driving four specialist subagents, so keep it small and readable —
this code is going on screen.

## Commands

- `npm test` — the whole suite (`node --test "test/*.test.js"`)
- `node --test test/money.test.js` — one file
- `node --test --test-name-pattern "applies a percentage discount"` — one test

Pass the glob to `node --test` explicitly rather than relying on file discovery,
and don't "simplify" it to a bare directory.

## Conventions

- ES modules, Node 20+, **no dependencies**. `npm test` must work on a clean
  checkout with no install step.
- Money is always an integer number of cents. Never store or pass floating point
  dollars; convert at the display boundary with `formatCents`.
- Percentage discounts round half-up to the nearest cent. A discount never takes
  a line below zero.
- Validate arguments at the public API boundary: `TypeError` for the wrong type,
  `RangeError` for a value outside its allowed range. Don't add defensive checks
  between internal functions.
- Tests use `node:test` and `node:assert/strict`, one `describe` per module and
  one `it` per behavior. Test what a caller observes, not how it's implemented.
- Comments explain a constraint the code can't show. Don't narrate the next
  line, and don't leave notes about what changed.

## Layout

```
src/     money.js (cents arithmetic, formatCents), discounts.js, cart.js
test/    one *.test.js per module
docs/    DESIGN.md (written by the architect), API.md (by the doc-writer)
```

## Who owns what

The pipeline only works if each stage stays in its lane:

| Directory | Owner |
|-----------|-------|
| `docs/DESIGN.md` | architect |
| `src/` | implementer |
| `test/` | tester |
| `docs/API.md`, README usage | doc-writer |
| `package.json`, `CLAUDE.md`, root config | orchestrator |

`docs/DESIGN.md` is the contract — implementer and tester both work from it, and
a disagreement with it goes back to the architect rather than being resolved
locally.

If you are one of these subagents and the fix you want is outside your
directory, report it instead of making it.
