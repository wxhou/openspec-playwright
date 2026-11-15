// Auth setup for Playwright Test Agents
// This file authenticates once and saves the session state to .auth/user.json
// All subsequent tests reuse this state — no repeated logins needed.
//
// Setup (only if your app requires login):
//   1. Set credentials: export E2E_USERNAME=xxx E2E_PASSWORD=yyy
//   2. Enable auth: export E2E_AUTH_REQUIRED=true
//   3. Choose method: export E2E_AUTH_METHOD=api   # or ui
//      API endpoint: export E2E_AUTH_API=/api/auth/login   # optional; this is the default
//      Session check: export E2E_AUTH_CHECK_PATH=/api/me   # optional; asserted when set
//   4. Run: npx playwright test --project=setup
//
// If E2E_AUTH_REQUIRED is not true, auth setup is skipped so public apps
// can run seed/smoke tests without credentials.
//
// Multi-user: copy this file to auth.<role>.setup.ts, replace the single-user
// env vars with E2E_<ROLE>_USERNAME / E2E_<ROLE>_PASSWORD, and write
// playwright/.auth/<role>.json. Add one Playwright project per role with its
// own storageState.

import { test as setup, expect } from '@playwright/test';
import { existsSync } from 'fs';

const authRequired = process.env.E2E_AUTH_REQUIRED === 'true';
const authMethod = process.env.E2E_AUTH_METHOD || 'api';

// ─── API Login (preferred) ───────────────────────────────────────────────────
// Set E2E_AUTH_API to your login endpoint (default: /api/auth/login).
// API login assumes cookie-based auth; token/localStorage auth needs UI login.

setup('authenticate via API', async ({ page }) => {
  setup.skip(!authRequired || authMethod !== 'api', 'API auth not required/enabled');

  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const apiPath = process.env.E2E_AUTH_API || '/api/auth/login';
  const username = process.env.E2E_USERNAME;
  const password = process.env.E2E_PASSWORD;

  if (!username || !password) {
    throw new Error(
      'E2E_USERNAME and E2E_PASSWORD environment variables are required when E2E_AUTH_REQUIRED=true.\n' +
      'Set them with: export E2E_USERNAME=xxx E2E_PASSWORD=yyy'
    );
  }

  const res = await page.request.post(new URL(apiPath, baseUrl).toString(), {
    data: { username, password },
  });

  if (!res.ok()) {
    throw new Error(`API login failed (${res.status()}). Check credentials and E2E_AUTH_API.`);
  }

  const cookies = await page.context().cookies();
  if (cookies.length === 0) {
    throw new Error(
      'API login returned success but set no cookies. If your app stores auth in localStorage or a token, use E2E_AUTH_METHOD=ui.'
    );
  }

  const checkPath = process.env.E2E_AUTH_CHECK_PATH;
  if (checkPath) {
    const check = await page.request.get(new URL(checkPath, baseUrl).toString());
    if (!check.ok()) {
      throw new Error(`Auth check failed (${check.status()}) at ${checkPath}.`);
    }
  }

  await page.context().storageState({ path: './playwright/.auth/user.json' });

  if (!existsSync('./playwright/.auth/user.json')) {
    throw new Error('Auth setup failed: storageState file was not created');
  }
});

// ─── UI Login (fallback) ─────────────────────────────────────────────────────
// If no login API, use UI login. Update selectors to match your login page.

setup('authenticate via UI', async ({ page }) => {
  setup.skip(!authRequired || authMethod !== 'ui', 'UI auth not required/enabled');

  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const username = process.env.E2E_USERNAME;
  const password = process.env.E2E_PASSWORD;

  if (!username || !password) {
    throw new Error(
      'E2E_USERNAME and E2E_PASSWORD environment variables are required when E2E_AUTH_REQUIRED=true.\n' +
      'Set them with: export E2E_USERNAME=xxx E2E_PASSWORD=yyy'
    );
  }

  // TODO: Update these selectors to match your login page.
  // Prefer role/label selectors; use test IDs only when the form has no labels.
  await page.goto(`${baseUrl}/login`);

  // Anchor to the label start so toggles like "Remember email" / "Show password" do not match.
  const usernameField = page.getByLabel(/^(username|email)/i);
  await usernameField.fill(username);
  await expect(usernameField).toHaveValue(username);

  const passwordField = page.getByLabel(/^password/i);
  await passwordField.fill(password);

  // Primary form button only — excludes social-login buttons like "Log in with Google".
  await page.getByRole('button', { name: /^(log ?in|sign ?in)$/i }).click();
  // Fallbacks: page.getByTestId('username') / page.getByTestId('login-button')

  // Positive, path-anchored success check; never assert the password value (it echoes into failures).
  await page.waitForURL((url) => /^\/(dashboard|home|profile)(\/|$)/.test(url.pathname));

  await page.context().storageState({ path: './playwright/.auth/user.json' });

  if (!existsSync('./playwright/.auth/user.json')) {
    throw new Error('Auth setup failed: storageState file was not created');
  }
});
