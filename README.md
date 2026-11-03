# Orchestrator + subagents — worked example

A complete Claude Code setup where one **orchestrator** drives four specialist
**subagents**, each on a different model, through a fixed pipeline:

```
you ──▶ orchestrator (Opus 5)
          │
          ├─▶ architect     (Fable 5)    → docs/DESIGN.md
          ├─▶ implementer   (Opus 5)     → src/
          ├─▶ tester        (Sonnet 5)   → test/  + npm test
          └─▶ doc-writer    (Haiku 4.5)  → docs/API.md
```

The project being worked on is a dependency-free cart pricing engine, small
enough to read on screen and complete enough that a real feature request has
somewhere to go.

## Usage

The cart applies tiered volume discounts automatically: 5% off at 10 units, 10%
off at 25 units (cart-wide). The volume discount applies **first** to the raw
subtotal, then coupons apply **in order** to the running total:

```js
import { createCart, addItem, total, subtotal, itemCount } from './src/cart.js';
import { percentOff, amountOff } from './src/discounts.js';

const cart = createCart();
addItem(cart, { sku: 'mug', unitPriceCents: 1000, quantity: 10 });

subtotal(cart);                                        // 10000
itemCount(cart);                                       // 10
total(cart);                                           // 9500 (10000 - 5% volume discount)

total(cart, [percentOff('SAVE10', 10), amountOff('FIVER', 500)]);
// Discounts in order: 9500 -> -10% (950) -> 8550 -> -500 -> 8050

total(cart, [amountOff('FIVER', 500), percentOff('SAVE10', 10)]);
// Discounts in order: 9500 -> -500 -> 9000 -> -10% (900) -> 8100
```

Volume discount precedence is fixed: volume tier first, coupons in the order
given. This makes the volume discount amount predictable regardless of which
coupons are present.

## Why different models per agent

Each subagent runs in its own context window with its own model, so you pay for
capability only where it changes the outcome:

| Agent | Model | Why |
|-------|-------|-----|
| `orchestrator` | `opus` | Plans the work and judges each handoff. Writes no code. |
| `architect` | `fable` | The hardest reasoning in the pipeline — one design decision constrains everything after it. |
| `implementer` | `opus` | Writing correct code against a fixed design. |
| `tester` | `sonnet` | Mechanical against a design's test-case list, and it runs the suite twice. |
| `doc-writer` | `haiku` | Transcription, not judgment. Cheapest model that reads code accurately. |

`model: fable` requires Claude Fable 5 access. Without it, Claude Code prints a
warning and runs the architect on the session model — change the line in
`.claude/agents/architect.md` to `model: opus` to avoid that on camera.

## Files

```
.claude/agents/orchestrator.md   the pipeline driver (tools: Agent, Read, Glob, Grep)
.claude/agents/architect.md      read-only + Write, owns docs/DESIGN.md
.claude/agents/implementer.md    owns src/
.claude/agents/tester.md         owns test/, runs npm test
.claude/agents/doc-writer.md     owns docs/API.md
.claude/commands/feature.md      /feature <request> — starts the pipeline
.claude/settings.json            pre-approves the test commands
CLAUDE.md                        project conventions every agent inherits
src/                             money.js, discounts.js, cart.js
test/                            cart.test.js — 26 tests, all passing
docs/API.md                      current public API
```

## Run it

```bash
npm test                    # 26 passing, no install needed
claude --agent orchestrator # start the session as the orchestrator
```

`--agent orchestrator` makes the orchestrator definition the main session agent,
so the session itself has only `Agent, Read, Glob, Grep` — it can delegate and
inspect, but not edit files or run commands. That restriction is the point; add
tools to `.claude/agents/orchestrator.md` if you want a looser session.

**Before recording:** start Claude Code here once interactively and accept the
trust dialog. Until you do, the pre-approved commands in `.claude/settings.json`
are ignored and the tester will stop for a permission prompt mid-take.

Then type a feature request. This one exercises all four stages and has a real
design decision in it (what order discounts stack in, and what happens when a
tier and a coupon both apply):

```
Add tiered volume discounts — 5% off at 10 units, 10% at 25 — that stack
with coupon codes under a documented precedence order.
```

Or, from a normal session without `--agent`:

```
/feature Add tiered volume discounts that stack with coupon codes
```

## What to point at while recording

- **The subagent panel** below the prompt shows each agent spawning, its model,
  and its color. That is the whole lesson in one frame.
- **`docs/DESIGN.md` appearing before any code changes.** The handoff is a file
  on disk, not a summary passed in context — the implementer reads the design
  rather than trusting a paraphrase of it.
- **Context isolation.** The tester's file reads and test output never enter the
  main conversation; only its summary comes back. That's the reason to delegate
  at all.
- **A failing test getting routed back.** If the tester reports a failure, the
  orchestrator hands it to the implementer and re-runs the tester — it doesn't
  fix the code itself. Worth forcing on camera by asking for a feature with an
  edge case (negative quantities, or a 100% coupon on a tiered cart).
- **Ownership boundaries.** The architect has no Edit tool; the doc-writer has
  no Bash. Ask an agent to step outside its lane and watch it report back
  instead.

## Adapting it

- **Rename the agents** to your own pipeline (`security-reviewer`,
  `perf-analyst`) — identity comes from the `name` field, not the filename.
- **Drop the models down a tier** to rehearse cheaply, then switch back for the
  take.
- **`~/.claude/agents/`** instead of `.claude/agents/` makes the same team
  available in every project.
- Subagents can spawn their own subagents up to three layers deep. Change that
  with `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`, which goes inside the `env` block
  of `.claude/settings.json` — `"1"` turns nesting off:

  ```json
  { "env": { "CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH": "1" } }
  ```
