// Global Teardown for Playwright Test Agents
// This file runs AFTER all tests complete — use it to clean up test data.
//
// Setup:
//   1. Uncomment the teardown project in playwright.config.ts
//   2. Customize the cleanup logic below for your project
//   3. Run: npx playwright test (teardown runs automatically after all tests)
//
// Common use cases:
//   - Database cleanup: DELETE test records created during E2E runs
//   - API cleanup: Call /api/test/cleanup endpoint
//   - File cleanup: Remove uploaded test files or artifacts
//   - Cache invalidation: Clear Redis/Memcached test keys

import { test as teardown } from '@playwright/test';

teardown('cleanup test data', async ({ request }) => {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

  // ─── Option 1: API-based cleanup (recommended) ───────────────────────────
  // If your app has a test cleanup endpoint, call it here.
  // Example: POST /api/test/cleanup with a secret token
  //
  // const cleanupToken = process.env.E2E_CLEANUP_TOKEN;
  // if (cleanupToken) {
  //   const res = await request.post(`${baseUrl}/api/test/cleanup`, {
  //     headers: { 'X-Cleanup-Token': cleanupToken },
  //   });
  //   if (!res.ok()) {
  //     console.warn(`Cleanup API returned ${res.status()}`);
  //   }
  // }

  // ─── Option 2: Database cleanup (direct connection) ──────────────────────
  // If you have direct DB access, clean up test records.
  // Example using pg (PostgreSQL):
  //
  // import { Pool } from 'pg';
  // const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  // await pool.query(`
  //   DELETE FROM orders WHERE email LIKE '%@test.example.com';
  //   DELETE FROM users WHERE email LIKE '%@test.example.com';
  // `);
  // await pool.end();

  // ─── Option 3: File cleanup ──────────────────────────────────────────────
  // Remove test-generated files or uploads.
  //
  // import { rm } from 'fs/promises';
  // await rm('./uploads/test-*', { recursive: true, force: true });

  // ─── Option 4: Session/cache cleanup ─────────────────────────────────────
  // Invalidate test sessions or cache entries.
  //
  // import Redis from 'ioredis';
  // const redis = new Redis(process.env.REDIS_URL);
  // const keys = await redis.keys('session:test-*');
  // if (keys.length) await redis.del(...keys);
  // await redis.quit();

  console.log('✓ Global teardown completed');
});

// ─── Additional teardown tasks (optional) ──────────────────────────────────
// Add more teardown blocks if you need to clean up different resources
// in a specific order.

// teardown('cleanup uploaded files', async ({ }) => {
//   // File cleanup logic
// });

// teardown('invalidate cache', async ({ }) => {
//   // Cache cleanup logic
// });
