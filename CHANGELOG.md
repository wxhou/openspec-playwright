# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- `employee-standards.md`: complete rewrite — add 6-chapter structure (适用范围、浏览器操作约束、代码质量、上下文管理、大规模任务处理、工具限制与编辑安全) + 完整生产工作流（含步骤详解 + 反馈循环表）；4轮深度检查后 P0/P1 问题全部修复

## [0.2.9] - 2026-04-10

### Changed
- `SKILL.md` v2.22: Phase 2 Step 5 selector repair — split into 5a Extract (structured candidate list with stability ranking: Stable/Fair/Fragile, project-specific upgrade via Common Selector Patterns) and 5b Select (top candidate with reason); Selector Fixes log adds date field; add "Before Phase 1 — check accumulated knowledge" step to leverage app-knowledge.md Selector Fixes table for known fixes (closes the learning loop); add file-missing guard

## [0.2.8] - 2026-04-10

### Changed
- `SKILL.md` v2.20: add redirect/refresh loop detection — navigate后两次URL对比+console累积检测；Phase 1 Triage新增Redirect Loop和Page Refresh Loop类型；Graceful Degradation新增对应条目

## [0.2.7] - 2026-04-10

### Changed
- `SKILL.md` v2.18: streamlined skill document — removed redundant Report Structure chapter, Step 5 confirmation criteria (duplicate of Test Plan Summary), and LoginPage duplicate example; compressed special element capture code and code templates into brief references pointing to templates; simplified Step 6.2 selector patterns into compact table (~230 lines reduced)

### Fixed
- `SKILL.md` v2.19: Test Plan Summary Special Elements section now only lists elements actually detected in Step 4 exploration (no longer pre-populates all 8 types); Infinite scroll and WebSocket/SSE detection now require explicit spec mention or real-time features (consistent with Date picker rule)

## [0.2.6] - 2026-04-09

### Added
- `openspec-pw audit` command: scans `tests/playwright/` for orphaned spec files, routes not in sitemap, missing auth.setup, and old-style file locations
- `openspec-pw run --update-snapshots`: passes `--update-snapshots` to Playwright for updating screenshot baselines
- `SKILL.md` Step 6: add `toHaveScreenshot()` visual regression examples for key pages, form states, and Canvas/WebGL

### Changed
- README.md & README.zh-CN.md: added `audit` and `migrate` to CLI command tree

## [0.2.5] - 2026-04-09

### Fixed
- `openspec-pw migrate`: removed OpenSpec validation to support archived/renamed changes

### Added
- `openspec-pw run`: `--headed` flag to show browser during test run

## [0.2.3] - 2026-04-09

### Changed
- Change test files now live under `tests/playwright/changes/<name>/<name>.spec.ts` (mirrors OpenSpec's change management philosophy); shared assets (seed.spec.ts, auth.setup.ts, credentials.yaml, pages/) remain at `tests/playwright/` root
- `run.ts`: test file lookup now uses `changes/<name>/` subdirectory structure
- `run.ts`: "all" mode test file lookup corrected to `tests/playwright/app-all.spec.ts` (not under changes/)
- `run.ts`: "file not found" error message now shows correct path for both change and "all" modes
- `run.ts`: added `--app-bugs`, `--healed`, `--raft`, `--escalated` flags for Healer classification reporting
- `SKILL.md`: updated all path references from `tests/playwright/<name>.spec.ts` to `tests/playwright/changes/<name>/<name>.spec.ts` (5 locations + Architecture table)
- `SKILL.md`: Phase 3 decision tree and Guardrails paths updated to new structure
- `README.md` & `README.zh-CN.md`: architecture diagram and CLI tree updated to reflect new structure
- `docs/plans/`: design doc path references updated

### Added
- `openspec-pw migrate` command: scans `tests/playwright/` for old-style `<name>.spec.ts` files and moves them to the new `changes/<name>/` structure; no longer requires OpenSpec change to exist (supports archived/renamed changes)
  - `--dry-run` / `-n`: preview without moving
  - `--force` / `-f`: overwrite existing files at destination

## [0.2.2] - 2026-04-08

### Fixed
- `SKILL.md` Signal table: re-run command was `openspec-pw run` during exploration phase (no test file exists yet) — now correctly uses `/opsx:e2e` to re-explore
- `SKILL.md` all mode: `app-all.spec.ts` filename didn't match `openspec-pw run` lookup (`all.spec.ts`) — `run.ts` now supports `all` as alias for `app-all.spec.ts`
- `SKILL.md` Graceful Degradation: exploration STOP (HTTP 5xx/JS error) had no defined follow-up — now specifies re-run `/opsx:e2e` to re-explore
- `SKILL.md` Phase 2: heal cap (3 attempts) was per-instance — same test could loop indefinitely — now added global attempt guard
- `SKILL.md` Phase 3: "same choice ≥2" guard only prevented (a→a), not (a→b→c→a) loops — now upgraded to 3 consecutive escalations trigger
- `SKILL.md` all mode: idempotency said "verify routes vs specs" — all mode has no specs — now says "verify routes vs live app"

### Changed
- `SKILL.md` Step 9 command syntax: `--project=<role>` → `[--project <role>`]` to match actual CLI interface
- `SKILL.md` Step 10 RAFT isolation: unified to `openspec-pw run --grep` (was using raw `npx playwright test`)
- `SKILL.md` Step 7 auth setup: "Re-run /opsx:e2e" → `openspec-pw run` with clarification that it jumps to Step 9 directly
- `SKILL.md` Step 5 all mode: clarified "skip" refers to test-plan generation, confirmation still shows
- `SKILL.md` Guardrails: corrected write permissions from `specs/playwright/` to accurate paths (`tests/playwright/` + `openspec/changes/<name>/specs/playwright/`)
- `run.ts`: added `--grep` / `-g` option for isolated test re-run (used by Healer Phase 1/2 and RAFT detection)

## [0.2.1] - 2026-04-08

### Changed
- `SKILL.md` Testing principles: clarify setup (API OK) vs assertion (UI required) — `page.request` only for visible results is now an explicit per-assertion rule
- `SKILL.md` Generator: add per-assertion UI check hook before writing each assertion
- `SKILL.md` Step 4: React 19/Next.js App Router → `networkidle`; Vue/Angular/React 18/Plain JS/jQuery → `waitForSelector`
- `SKILL.md` Phase 1 Timeout: add framework-aware healing path
- `employee-standards.md`: 200+ line changes must go through OpenSpec workflow

## [0.2.0] - 2026-04-08

### Changed
- `SKILL.md` Step 9 Healer: replace flat decision table with 3-phase protocol (Phase 1 Triage → Phase 2 Repair → Phase 3 Escalate)
- `SKILL.md` Step 9: add explicit "ASSERTION vs ACTUAL" comparison before fixing
- `SKILL.md` Step 9: distinguish Flaky (retry isolated, not counted) from Test Bug (Phase 2)
- `SKILL.md` Step 9: Phase 3 escalation outputs structured 4-option question to user instead of guessing test vs app bug
- `SKILL.md` Step 10: add RAFT detection guidance (suite fail → isolated pass = infrastructure coupling)
- `SKILL.md` Graceful Degradation: update failure classification with App Bug / Test Bug / RAFT / Human Escalation types
- `SKILL.md` Step 11: update report presentation to include failure type breakdown
- `templates/report.md`: redesigned with Summary metrics, Failure Classification table, Auto-Heal Log, RAFT Summary, Human Escalations sections
- `run.ts` `generateReport`: extended to output new report format with Failure Type / Healed columns and placeholder sections for Healer

### Breaking
- Drop support for Cursor, Cline, Gemini CLI, GitHub Copilot — E2E workflow is Claude Code only
- `editors.ts`: remove `detectEditors`, `installForAllEditors`, `ALL_ADAPTERS`, `EditorAdapter` interface; replace with `hasClaudeCode`, `installForClaudeCode`, `formatClaudeCommand`, `getClaudeCommandPath`
- `init.ts`: remove multi-editor detection logic; require `.claude/` to be present or exit early
- `update.ts`: same simplification
- `uninstall.ts`: remove adapter loop; use `getClaudeCommandPath` directly
- `tests/editors.test.ts`: rewrite for simplified API
- `tests/smoke.test.ts`: update smoke tests for new exports

### Fixed
- `doctor.ts`, `init.ts`, `update.ts`, `uninstall.ts`: replace direct `.claude.json` parsing with `claude mcp list` / `claude mcp remove`

## [0.1.80] - 2026-04-08

### Fixed
- `doctor.ts`, `init.ts`, `update.ts`, `uninstall.ts`: replace direct `.claude.json` parsing with `claude mcp list` / `claude mcp remove` — platform-independent, uses Claude Code CLI as source of truth instead of JSON file

## [0.1.80] - 2026-04-08

### Fixed
- `SKILL.md`: fix 6 template path references from `templates/xxx` to `.claude/skills/openspec-e2e/templates/xxx` (paths were broken in v0.1.78 refactor)
- `update.ts`: `syncProjectTemplates` now uses full content comparison instead of single-flag detection for BasePage.ts
- `update.ts`: add `syncCredentials` to preserve user credentials when updating credentials.yaml template (auto-backup + merge)
- `update.ts`: add `app-knowledge.md` generation (if missing) during update flow
- `update.ts`: add `.claude` existence check and "no editors detected" messages for consistency
- `.prettierignore`: restore `templates/` to ignore list

### Changed
- `src/index.ts`: `--seed/--no-seed` broken commander syntax replaced with two separate boolean options
- `syncSkillTemplates`: now only updates when content actually differs (no spurious output)

### Removed
- `cleanupDeprecatedSchema` from `update.ts` (schemas/ no longer in package — cleanup unnecessary)

## [0.1.79] - 2026-04-07

### Fixed
- `init.ts`: implement `--seed` flag to force regenerate `seed.spec.ts` (overwrites existing file)
- `update.ts`: fix duplicate warning when `seed.spec.ts` is outdated (`syncProjectTemplates` called twice)

### Changed
- `update.ts`: warning message now correctly suggests `openspec-pw init --seed` instead of non-existent `--seed` option

## [0.1.78] - 2026-04-07

### Added
- `SKILL.md` (v2.13): add Decision Table for Page Object file handling (create/extend/rewrite/remove)
- `SKILL.md` (v2.13): add Decision Table for route discovery fallback (sitemap→link→common paths)
- `SKILL.md` (v2.13): add Decision Table for Auth Confidence (High/Medium/Low → action)
- `SKILL.md` (v2.13): add Decision Table for Healer failure types (7 failure types with signals and actions)
- `SKILL.md` (v2.13): add complete Healer protocol (5-step workflow with STOP guard at 3 attempts)
- `SKILL.md` (v2.13): add STOP guard header to Graceful Degradation section
- `SKILL.md` (v2.13): restructure Guardrails from prose to Decision Table + file whitelist
- `SKILL.md` (v2.13): add Output path for `playwright.config.ts`
- `SKILL.md` (v2.13): clarify `app-exploration.md` template path (`.claude/skills/openspec-e2e/templates/`)
- `SKILL.md` (v2.12): add Step 1 Decision Table — Routes table replaces entirely (no append)
- `SKILL.md` (v2.12): add Step 6 Generator role identity + Page Object pattern (Read templates/e2e-test.ts)
- `SKILL.md` (v2.12): add ✅/❌ code pattern comparison for Page Objects (getters vs inline locators)
- `SKILL.md` (v2.12): add Page Object file naming convention (kebab→PascalCase)
- `templates/app-knowledge.md`: add **Routes** table for discovered routes (Route, Auth, Page Object, Notes)
- `templates/e2e-test.ts`: expand LoginPage example with full implementation pattern

### Fixed
- `SKILL.md` (v2.13): Step 6.1 LoginPage click consistency — `this.submitBtn.click()` → `this.click(this.submitBtn)`
- `SKILL.md` (v2.13): Step 8 `playwright.config.ts` template path now explicit
- `SKILL.md` (v2.13): Step 4.5 Dynamic content assertion — `toContainText` or regex (not `toHaveText`)
- `SKILL.md` (v2.13): Graceful Degradation table — remove duplicate **STOP** bold since header covers it
- `SKILL.md` (v2.13): Output section — remove duplicate "Auth setup" line
- `update.ts`: auto-sync `tests/playwright/pages/BasePage.ts` when missing `fillAndVerify()` (v0.1.75+ feature)
- `update.ts`: warn if `seed.spec.ts` is outdated and missing `fillAndVerify()` examples

## [0.1.77] - 2026-04-07

### Changed
- `run.ts`: switch from `--reporter=list` to `--reporter=json` for authoritative structured results
- `run.ts`: add `parsePlaywrightJsonReport()` to directly extract screenshot paths from Playwright JSON report output
- `run.ts`: `parsePlaywrightOutput()` (list stdout) becomes fallback when JSON report unavailable

### Added
- `JsonReporterSuite`, `JsonReporterTest`, `JsonReporterTestResult`, `JsonReporterAttachment` TypeScript interfaces for type-safe JSON parsing

## [0.1.76] - 2026-04-07

### Added
- Markdown report: add "Screenshot" column — links directly to screenshot file path from reporter attachment

## [0.1.75] - 2026-04-07

### Fixed
- `BasePage.fill()` / `type()`: add `blur()` after operation to trigger Vue/React change events and reactive updates, preventing "input not committed before next action" race conditions
- `BasePage`: add `fillAndVerify()` method for fields with debounced validation or when the next action depends on the value being fully committed

### Changed
- `SKILL.md`: update AppPage pattern example to use `fillAndVerify()`; update UI test code example to show verified fill pattern
- `auth.setup.ts`: add `toHaveValue()` verification after each fill in UI login fallback
- `seed.spec.ts`: update error path example to use `fillAndVerify()`
- `e2e-test.ts`: update login example to use `fillAndVerify()`

## [0.1.74] - 2026-04-03

### Added
- `SKILL.md`: add special element detection (Step 4.3.1) — canvas, iframe, Shadow DOM, contenteditable, video/audio, date pickers, drag-and-drop, infinite scroll, WebSocket/SSE
- `SKILL.md`: add special element test code patterns in Step 6 — with `toBeGreaterThan(0)` dimension checks and `toContainText` assertions
- `templates/app-exploration.md`: add "Special Elements Detected" table (Element, Type, Context, Dimensions, Test Strategy)
- `templates/test-plan.md`: add "Special Element Test Cases" section (canvas-2d, canvas-webgl, iframe, contenteditable, video, audio)
- `templates/pages/BasePage.ts`: new shared base class with goto, selector helpers (byTestId/byRole/byLabel/byText/byPlaceholder), safe click/fill/type with scrollIntoViewIfNeeded, waitForToast, waitForLoad, expectURL, expectText
- `templates/e2e-test.ts`: extend BasePage instead of inline AppPage class
- `templates/seed.spec.ts`: extend BasePage instead of inline AppPage class
- `init.ts`: generate `tests/playwright/pages/BasePage.ts` on init
- `SKILL.md Step 6.1`: add BasePage usage guide and AppPage pattern (extend BasePage → add page-specific selectors as getters)
- `SKILL.md Step 6.2`: add selector anti-pattern section (CSS class/ID fragility → prefer semantic selectors)

### Fixed
- `SKILL.md`: canvas context detection — check WebGL2→WebGL1→2D order to avoid consuming 2D context
- `SKILL.md`: canvas snapshot signal — use role="img" instead of tagName (tagName not in a11y tree)
- `SKILL.md`: test-plan.md heading typo ("Video — Audio Playback" → "Audio — Playback Control")
- `templates/pages/BasePage.ts`: fix expectGuest() broken logic (dead code) → use getByRole assertion
- `templates/pages/BasePage.ts`: waitForLoad comment clarified (silent timeout — caller should assert)
- `templates/pages/BasePage.ts`: expectText() — remove broken exact option for RegExp

### Changed
- `SKILL.md`: streamline Role mapping (table → inline note)
- `SKILL.md`: deduplicate Code examples section (removed redundant false-pass/API-login blocks)
- `SKILL.md`: compress Graceful Degradation table from 13 rows to 8 (merged duplicate scenarios)

## [0.1.72] - 2026-04-03

### Changed
- `update.ts`: auto-cleanup deprecated `openspec/schemas/playwright-e2e/` from pre-v0.1.71 versions
- `employee-standards.md`: streamline "搜索要全" rule wording (fewer words, same meaning)

## [0.1.71] - 2026-04-03

### Fixed
- `init.ts`: install 5 SKILL reference templates to `.claude/skills/openspec-e2e/templates/` (previously they were in npm package but never copied to project, causing SKILL references to fail)
- `update.ts`: sync SKILL reference templates from npm package
- `init.ts`: handle "already exists" gracefully when MCP is already installed (no scary error on Windows)
- `employee-standards.md`: OpenSpec 阶段隔离 title uses colon instead of period (format consistency)
- `employee-standards.md`: unify 'typecheck' spelling (remove inconsistent space)
- README.md & README.zh-CN.md: architecture diagrams updated to reflect new template location

### Changed
- Schema (openspec/schemas/playwright-e2e/) no longer installed to project — E2E workflow is fully SKILL-driven, not OpenSpec artifact-driven
- Templates migrated from `schemas/playwright-e2e/templates/` to `templates/` in npm package

## [0.1.70] - 2026-04-02

### Added
- `employee-standards.md`: E2E workflow isolation rule (prevents E2E auto-trigger from OpenSpec stages)

## [0.1.68] - 2026-04-02

### Added
- GitHub workflow for npm unpublish (temporary, later removed in this release)

### Removed
- GitHub unpublish workflow (no longer needed)

## [0.1.67] - 2026-04-02

### Changed
- (Unpublished — large refactor rolled back; see v0.1.68+)

## [0.1.66] - 2026-04-02

### Changed
- `employee-standards.md`: replace ambiguous "验证" with concrete terms ("lint + typecheck", "编辑要求")
- `employee-standards.md`: add OWASP Top 10 references for web and API projects
- `employee-standards.md`: principle-based code quality guidance (language-aware)
- Editor support: replace Windsurf with Cline (reduced supported editors from 23 to 5)
- Release workflow: add lockfile pre-check
- Smoke test: add npm pack verification and critical files check
- `package.json`: include `.claude/` and `employee-standards.md` in published package

## [0.1.65] - 2026-04-02

### Added
- `employee-standards.md`: E2E workflow isolation rule (prevents E2E auto-trigger from OpenSpec stages)

## [0.1.63] - 2026-04-02

### Added
- `openspec-pw uninstall` command to remove integration from a project
- `npm run typecheck` script (`tsc --noEmit`)
- `npm run test:smoke` script (build + smoke tests)
- `tests/smoke.test.ts` with smoke tests covering dist output, module imports, and CLI behavior
- CI workflow (`.github/workflows/ci.yml`) for pull request checks
- `package.json` `"files"` field to reduce npm package size
- Vitest coverage configuration (v8 + lcov reporter)
- CHANGELOG.md
- GitHub Issue Templates (bug report + feature request)

## [0.1.62] - 2026-04-02

### Changed
- `findNpmRoot` in `playwright.config.ts` now searches recursively (up to 5 levels) for nested monorepos
- Console listener leak fixed in `seed.spec.ts` — now properly removes listener in `test.afterEach`
- Empty `catch {}` blocks replaced with warnings in `init.ts`, `doctor.ts`, and `mcpSync.ts`
- `parseMcpReadme` now warns to stderr when README format changes and no tools are parsed
- README editor count corrected from 24 to 23

### Fixed
- Console listener leak in `seed.spec.ts` (`test.afterEach` now removes the handler)
- Release workflow version mismatch (tag now points to the version-bumped commit)
- Missing test step in release workflow (tests now run before publish)
