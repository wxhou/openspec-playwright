import { defineConfig } from '@playwright/test';
import type { WxaOptions } from '@open-wxa/wxa-runner-playwright';

// wxa-runner runs the compiled mini program in Chrome. The fixture starts one
// dev server per worker, so this config has no webServer block.
export default defineConfig<WxaOptions>({
  testDir: 'tests/playwright',
  outputDir: 'tests/playwright/test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    channel: 'chrome',
    wxaProject: '__WXA_PROJECT__',
    wxaServerOptions: { setup: './tests/playwright/wxa.setup.ts' },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
