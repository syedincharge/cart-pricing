---
description: Run a feature request through the architect, implementer, tester, and doc-writer pipeline
argument-hint: <feature request>
---

Run this feature request through the full pipeline as the orchestrator:

$ARGUMENTS

Delegate each stage with the Agent tool in order — architect, implementer,
tester, doc-writer — reading each stage's output file before starting the next.
Do not write code or edit files yourself; if the tester reports a failure, route
it back to the stage that owns the mistake rather than fixing it.
