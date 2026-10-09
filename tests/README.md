# Acceptance Tests

This directory is the home for acceptance tests in this project.

`openspec-pw init` detected **no frontend signal**, so it installed only this
scaffold plus the employee-grade standards block (AGENTS.md / CLAUDE.md) — no
Playwright scaffold. Backend / API projects verify behavior with their own
test stack; the standards' verification strategy is the contract:

- Backend / services: send real requests against a real running service,
  land them as integration tests (real data/dependencies).
- Every acceptance expectation anchors to the spec: "expected X, got Y".
- Behaviors named by acceptance criteria and core business logic must be
  covered by some test layer.

Use whichever framework fits the stack (supertest, pytest + httpx, go test,
Playwright's `request` fixture, ...). Add frontend later? Re-run
`openspec-pw init` (or with `--frontend`) — the full Playwright scaffold
installs incrementally and this file is removed.