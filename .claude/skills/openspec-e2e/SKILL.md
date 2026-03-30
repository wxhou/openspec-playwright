---
name: openspec-e2e
description: Run Playwright E2E verification for an OpenSpec change. Use when the user wants to validate that the implementation works end-to-end by running Playwright tests generated from the specs.
license: MIT
compatibility: Requires openspec CLI, Playwright (with browsers installed), and @playwright/mcp (globally installed via `claude mcp add playwright npx @playwright/mcp@latest`).

**Architecture**: Uses CLI + SKILLs (not `init-agents`). This follows Playwright's recommended approach for coding agents — CLI is more token-efficient than loading MCP tool schemas into context. MCP is used only for Healer (UI inspection on failure).
metadata:
  author: openspec-playwright
  version: "2.7"
---

## Input

- **Change name**: `/opsx:e2e <name>` or auto-detected from context
- **Specs**: `openspec/changes/<name>/specs/*.md`
- **Credentials**: `E2E_USERNAME` + `E2E_PASSWORD` env vars

## Output

- **Test file**: `tests/playwright/<name>.spec.ts`
- **Auth setup**: `tests/playwright/auth.setup.ts` (if auth required)
- **Report**: `openspec/reports/playwright-e2e-<name>-<timestamp>.md`
- **Test plan**: `openspec/changes/<name>/specs/playwright/test-plan.md`

## Architecture

This skill implements the Playwright Test Agents pipeline:

- **🎭 Planner** (Step 4): Consumes OpenSpec specs (`specs/*.md`) and produces `test-plan.md` — combines OpenSpec's structured requirements with LLM编排.
- **🎭 Generator** (Step 5): Transforms the Markdown test-plan into real Playwright `.spec.ts` files using LLM code generation.
- **🎭 Healer** (Step 8): Executes the test suite and automatically repairs failing selectors via Playwright MCP tools.

Uses CLI + SKILLs (not `init-agents`). This follows Playwright's recommended approach for coding agents — CLI is more token-efficient than loading MCP tool schemas into context. MCP is used only for Healer (UI inspection on failure).

**Schema owns templates. CLI handles execution. Skill handles cognitive work.**

## Steps

### 1. Select the change

If a name is provided (e.g., `/opsx:e2e add-auth`), use it. Otherwise:
- Infer from conversation context if the user mentioned a change
- Auto-select if only one active change exists
- If ambiguous, run `openspec list --json` and use the **AskUserQuestion tool** to let the user select

After selecting, announce: "Using change: `<name>`" and how to override.

Verify specs exist:
```bash
openspec status --change "<name>" --json
```
If `openspec/changes/<name>/specs/` is empty, inform the user and stop. E2E requires specs.

### 2. Read specs and detect auth

Read all files from `openspec/changes/<name>/specs/*.md`. Extract functional requirements.

Detect if auth is required. Mark as **auth required** only when BOTH conditions are met:

**Condition A — Explicit markers**: "login", "signin", "logout", "authenticate", "protected", "authenticated", "session", "unauthorized"

**Condition B — Context indicators**: Protected routes ("/dashboard", "/profile", "/admin"), role mentions ("admin", "user"), redirect flows

**Exclude false positives** — HTTP header examples (`Authorization: Bearer ...`) and code snippets do not count.

**Confidence levels**:
- High (auto-proceed): Multiple explicit markers AND context indicators
- Medium (proceed with note): Single explicit marker, context unclear
- Low (skip auth): No explicit markers found

### 3. Validate environment

Before generating tests, verify the environment is ready by running the seed test:

```bash
npx playwright test tests/playwright/seed.spec.ts --project=chromium
```

**What this validates**:
- App server is reachable (BASE_URL accessible)
- Auth fixtures (`storageState`) are initialized if auth is required
- Playwright browser and config are working

**If seed test fails**: Stop and report the failure. User must fix the environment before proceeding.

**If seed test passes or no auth required**: Proceed to Step 4.

### 4. Generate test plan

Create `openspec/changes/<name>/specs/playwright/test-plan.md` by:
- Listing each functional requirement as a test case
- Marking each with `@role(user|admin|guest|none)` and `@auth(required|none)`
- Including happy path AND key error paths
- Referencing the route/page each test targets

**Idempotency**: If test-plan.md already exists → read it, use it, do NOT regenerate unless user explicitly asks.

### 5. Generate test file (LLM-driven)

Use your file writing capability to create `tests/playwright/<name>.spec.ts`.

**Read inputs first**:
- `openspec/changes/<name>/specs/playwright/test-plan.md` — test cases with `@role` and `@auth` tags
- `tests/playwright/seed.spec.ts` — code pattern, BASE_URL, and page object structure

**Generate Playwright code** for each test case from test-plan.md:
- Follow the same structure as `seed.spec.ts`
- Prefer `data-testid` selectors; fallback to `input[name="..."]` or semantic selectors
- Include **happy path** AND **error/edge cases**
- Use `test.describe(...)` for grouping related tests
- Each test: `test('描述性名称', async ({ page }) => { ... })`
- Add `@project(user)` / `@project(admin)` on role-specific tests

### Anti-Pattern Warnings (Generator)

**🚫 NEVER do this — False Pass pattern:**
```typescript
// WRONG: If button doesn't exist, test silently passes and tests nothing
const btn = page.getByRole('button', { name: '取消' }).first();
if (await btn.isVisible().catch(() => false)) {
  await btn.click();
  await expect(page.getByText('成功')).toBeVisible();
}
// ✅ CORRECT: Use assertion — test fails if element is missing
await expect(page.getByRole('button', { name: '取消' })).toBeVisible();
await page.getByRole('button', { name: '取消' }).click();
await expect(page.getByText('成功')).toBeVisible();
```

**Why it matters**: A test that passes but skipped its logic gives **false confidence**. It reports green but tests nothing. Worse — if the test modifies data, a skipped run can corrupt state for the next test.

**🚫 NEVER rely on Playwright projects for permission filtering:**
```typescript
// WRONG: All tests run under both admin AND user projects — false "16 tests" impression
projects: [{ name: 'admin' }, { name: 'user' }]

// ✅ CORRECT: Use @tag for permission-based test filtering
test('admin only - activate subscription', { tag: '@admin' }, async ({ page }) => { ... });
test('user only - view subscription', { tag: '@user' }, async ({ page }) => { ... });
// Run with: npx playwright test --grep "@admin"
```

**🚫 NEVER skip auth guard tests:**
The auth guard is a **critical security feature**. Skipping it leaves a gap in coverage.
```typescript
// ✅ CORRECT: Test auth guard with a FRESH browser context (no cookies, no storage)
test('redirects unauthenticated user to login', async ({ browser }) => {
  const freshContext = await browser.newContext(); // No session cookies
  const freshPage = await freshContext.newPage();
  await freshPage.goto(`${BASE_URL}/dashboard`);
  await expect(freshPage).toHaveURL(/login|auth/);
  await freshContext.close();
});
```

**Always include error path tests** (not just happy paths):
- API returns 500 → UI error message displayed?
- API returns 404 → graceful "not found" handling?
- Network timeout → retry or error UX?
- Invalid input → validation message shown?

**Example pattern** (from seed.spec.ts):
```typescript
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Feature Name', () => {
  test('happy path - action succeeds', async ({ page }) => {
    await page.goto(`${BASE_URL}/path`);
    await page.getByTestId('element').click();
    await expect(page.getByTestId('result')).toBeVisible();
  });

  test('error case - invalid input shows message', async ({ page }) => {
    await page.goto(`${BASE_URL}/path`);
    await page.getByTestId('input').fill('invalid');
    await page.getByTestId('submit').click();
    await expect(page.getByTestId('error')).toContainText('Error text');
  });
});
```

**Write the file** using the Write tool. If the file already exists → diff against test-plan, add only missing test cases, preserve existing implementations.

**Selector guidance**: If no `data-testid` exists in the app, prefer `getByRole`, `getByLabel`, `getByText` over fragile selectors like CSS paths.

### 6. Configure auth (if required)

If auth is required:

**API login**: If specs mention `/api/auth/login` or similar → generate `tests/playwright/auth.setup.ts` using API login with `E2E_USERNAME`/`E2E_PASSWORD`.

**UI login**: Otherwise → generate `tests/playwright/auth.setup.ts` using UI login. Update selectors to match the login page (look for `data-testid` attributes or fallback to `input[name="..."]`).

**Multi-user**: If specs mention multiple roles (admin + user) → generate separate `auth.setup.ts` blocks for each role with different `storageState` paths.

**Prompt user** with:
```
Auth required. To set up credentials:

1. Customize tests/playwright/credentials.yaml with your test user
2. Export: export E2E_USERNAME=xxx E2E_PASSWORD=yyy
3. Run auth: npx playwright test --project=setup
4. Then re-run /opsx:e2e to execute tests
```

**Idempotency**: If `auth.setup.ts` already exists → verify format, update only if stale.

### 7. Configure playwright.config.ts (non-destructive)

If `playwright.config.ts` does not exist → generate it from the schema template at `openspec/schemas/playwright-e2e/templates/playwright.config.ts`. The template auto-detects:
- **BASE_URL**: from `process.env.BASE_URL`, falling back to `tests/playwright/seed.spec.ts` → `BASE_URL` value, then `http://localhost:3000`
- **Dev command**: from `package.json` → scripts in order: `dev` → `start` → `serve` → `preview` → `npm run dev`

If `playwright.config.ts` exists → READ it first. Extract existing `webServer`, `use.baseURL`, and `projects`. Preserve ALL existing fields. Add `webServer` block if missing. Do NOT replace existing config values.

### 8. Execute tests via CLI

```bash
openspec-pw run <name> --project=<role>
```

**For role-based tests using `@tag`** (recommended over `--project` filtering):
```bash
npx playwright test tests/playwright/<name>.spec.ts --grep "@<role>"
```
The `--project` approach runs ALL tests under each project's credentials — use `@tag` with `--grep` for precise filtering.

The CLI handles:
- Server lifecycle (start → wait for HTTP → test → stop)
- Port mismatch detection
- Report generation at `openspec/reports/playwright-e2e-<name>-<timestamp>.md`

If tests fail → analyze failures, use **Playwright MCP tools** to inspect UI state, fix selectors in the test file, and re-run.

**Healer MCP tools** (in order of use):
<!-- MCP_VERSION: 0.0.68 -->

| Tool | Purpose |
|------|---------|
| `browser_navigate` | Go to the failing test's page |
| `browser_snapshot` | Get page structure to find equivalent selectors |
| `browser_console_messages` | Diagnose JS errors that may cause failures |
| `browser_take_screenshot` | Visually compare before/after fixes |
| `browser_run_code` | Execute custom fix logic (optional) |

**Healer workflow**:
1. Read the failing test → identify failure type by checking error message and console output
2. Classify the failure:

| Failure type | Signal | Action |
|-------------|--------|--------|
| **Network/backend** | `fetch failed`, `net::ERR`, 5xx, timeout | `browser_console_messages` → add `test.skip()` + report "backend error" |
| **Selector changed** | Element not found, page loaded | `browser_snapshot` → fix selector → re-run |
| **Assertion mismatch** | Element exists, wrong content/value | `browser_snapshot` → compare → fix assertion → re-run |
| **Timing issue** | `waitFor` timeout, race condition | Adjust wait strategy → re-run |

3. **Attempt heal** (up to 3 times):
   - Apply fix using `browser_snapshot` (prefer `getByRole`, `getByLabel`, `getByText`)
   - Re-run: `openspec-pw run <name> --project=<role>`

4. **After 3 failed attempts**, collect evidence:

   **Evidence checklist** (in order, stop at first match):
   | Check | Signal | Decision |
   |-------|--------|----------|
   | `browser_console_messages` | ERROR-level messages present | App bug → `test.skip()` + report "console error" |
   | `browser_snapshot` | Target element missing from DOM | App bug → `test.skip()` + report "element missing" |
   | `browser_snapshot` | Element exists, no errors | Test bug → report recommendation |

   - **App bug**: `test.skip('app bug — reason: <signal>')` + detailed report entry
   - **Test bug**: report with "likely selector change, verify manually at file:line"
   - Do NOT retry after evidence checklist — evidence is conclusive

### 9. False Pass Detection

Run **after** the test suite completes (even if all tests pass). Scan for silent skips that give false confidence:

**Indicator A — Conditional test logic:**
Look for patterns in the test file:
```typescript
if (await locator.isVisible().catch(() => false)) { ... }
```
→ If test passes, the locator might not exist → check with `browser_snapshot`
→ Report: "Test passed but may have skipped — conditional visibility check detected"

**Indicator B — Test ran too fast:**
A test covering a complex flow that completes in < 200ms is suspicious.
→ Inspect with `browser_snapshot` to confirm page state
→ Report: "Test duration suspiciously short — verify test logic was executed"

**Indicator C — Auth guard not tested:**
If specs mention "protected route" or "redirect to login" but no test uses a fresh browser context:
→ Report: "Auth guard not verified — test uses authenticated context (cookies/storage inherited)"
→ Recommendation: Add a test with `browser.newContext()` (no storageState) to verify the guard

If any false-pass indicator is found → add a **⚠️ Coverage Gap** section to the report.

### 10. Report results

Read the report at `openspec/reports/playwright-e2e-<name>-<timestamp>.md`.

**Present results to user**:
- Summary table (tests run, passed, failed, duration, final status)
- Any auto-heal notes
- Recommendations for failed tests (with specific `file:line` references)

**Update tasks.md** (if all tests pass):
- Read `openspec/changes/<name>/tasks.md`
- Find tasks related to E2E testing (look for `[ ]` items mentioning "test", "e2e", "playwright", "verify")
- Append a verification note: e.g. `✅ Verified via Playwright E2E (<timestamp>)`
- Write the updated content back using the Edit tool

## Output Format

### Report Structure (`openspec/reports/playwright-e2e-<name>-<timestamp>.md`)

```
# Playwright E2E Report — <name>

## Summary
| Tests | Passed | Failed | Duration | Status |
|-------|--------|--------|----------|--------|
| N     | N      | N      | Xm Xs    | ✅/❌   |

## Results

### Passed
| Test | Duration | Notes |
|------|----------|-------|
| ...  | ...      | ...   |

### Failed
| Test | Error | Recommendation |
|------|-------|----------------|
| ...  | ...   | file:line — fix |

## Auto-Heal Log
- Attempt N: selector fix → result

## Coverage
- [x] Requirement 1
- [ ] Requirement 2 (unverified)

## ⚠️ Coverage Gaps
> Tests passed but coverage gaps were detected. Review carefully.

| Test | Gap | Recommendation |
|------|-----|----------------|
| ... | Conditional visibility check — test may have skipped | file:line — use `expect().toBeVisible()` |
| ... | Auth guard uses inherited session | Add fresh context test: `browser.newContext()` |
| ... | Suspiciously fast execution (<200ms) | Verify test logic was actually executed |

### Updated tasks.md
```
- [x] Implement feature X ✅ Verified via Playwright E2E (2026-03-28)
```

## Graceful Degradation

| Scenario | Behavior |
|----------|----------|
| No specs found | Stop with info message — E2E requires specs |
| Seed test fails | Stop with failure — fix environment before proceeding |
| No auth required | Skip auth setup entirely |
| test-plan.md exists | Read and use it — never regenerate |
| auth.setup.ts exists | Verify format — update only if stale |
| playwright.config.ts exists | Read and preserve all fields — add only missing |
| Test fails (network/backend) | Skip with `test.skip()` — backend/app error, not test fragility |
| Test fails (selector) | Healer: snapshot → fix selector → re-run (≤3 attempts) |
| Test fails (assertion) | Healer: snapshot → fix assertion → re-run (≤3 attempts) |
| 3 heal attempts failed | Confirm root cause → if app bug: `test.skip()` + report; if unclear: report with recommendation |
| False pass detected | Report coverage gap → add to "⚠️ Coverage Gap" section in report |

## Verification Heuristics

- **Coverage**: Every functional requirement → at least one test
- **Selector robustness**: Prefer `data-testid`, fallback to semantic selectors
- **False positives**: If test fails due to test bug (not app bug) → fix the test
- **Actionability**: Every failed test needs a specific recommendation
- **No false passes**: Every passing test must actually execute its test logic — verify absence of `if (isVisible())` conditional patterns
- **Auth guard verified**: Protected routes must have a test using a fresh browser context (no inherited cookies)

## Guardrails

- Read specs from `openspec/changes/<name>/specs/` as source of truth
- Do NOT generate tests that contradict the specs
- **DO generate real, runnable Playwright test code** — not placeholders or TODO comments. Every test case in test-plan.md must produce an actual `test(...)` block.
- Do NOT overwrite files outside: `specs/playwright/`, `tests/playwright/`, `openspec/reports/`, `playwright.config.ts`, `tests/auth.setup.ts`
- Cap auto-heal at 3 attempts
- If no change specified → always ask user to select
