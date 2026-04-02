Run Playwright E2E verification for an OpenSpec change.

## Workflow

1. **Validate environment**: Run the seed test to confirm your app is reachable.

   ```bash
   npx playwright test tests/playwright/seed.spec.ts --project=chromium
   ```

   If it fails, fix your BASE_URL or start the dev server first.

2. **Select the change**: If no change name is provided, run `openspec list --json` and pick one. Then announce: "Using change: `<name>`".

3. **Read specs**: Read all files from `openspec/changes/<name>/specs/*.md`.

4. **Detect auth**: Check if specs mention login, protected routes, or session handling. See `tests/playwright/auth.setup.ts` for auth setup.

5. **Generate test plan**: Create `openspec/changes/<name>/specs/playwright/test-plan.md` listing each test case with `@auth(required|none)` and `@role(...)` tags. Skip if already exists.

6. **Generate tests**: Write `tests/playwright/<name>.spec.ts` from the test plan. Follow the patterns in `seed.spec.ts`:
   - Prefer `data-testid`, fallback to `getByRole`, `getByLabel`, `getByText`
   - Include happy path AND error/edge cases
   - Never use conditional `if (isVisible())` — always use `expect().toBeVisible()` (false-pass anti-pattern)
   - Use `browser.newContext()` for auth guard tests (fresh session, no cookies)

7. **Run tests**:

   ```bash
   openspec-pw run <change-name>
   ```

   Or with role filtering:

   ```bash
   npx playwright test tests/playwright/<name>.spec.ts --grep "@<role>"
   ```

8. **Fix failures**: If tests fail, analyze the error:
   - Network/backend error → `test.skip()` + report
   - Selector changed → use Playwright MCP tools to find equivalent selectors, fix, re-run
   - Auto-heal up to 3 attempts

9. **Report**: Results are saved to `openspec/reports/playwright-e2e-<name>-<timestamp>.md`. Present the summary table to the user.
