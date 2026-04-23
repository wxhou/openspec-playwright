# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.23] - 2026-04-22

### Fixed

- `employee-standards.md` Section 2: 静态验证改为语言检测——扫描项目根目录源码文件扩展名检测主语言（.py→ruff+mypy, .ts/.tsx→ESLint+tsc, .go→gofmt+vet），不依赖特定目录名或配置文件
- `employee-standards.md` Section 3 & 4.4: 统一引用"对应语言 lint + typecheck"，替代写死的 ESLint/tsc
- `employee-standards.md` Section 5: 新增"禁止脚本改文件"规则——修改源码只能使用内置编辑工具，格式化工具（ruff fmt、prettier）除外
- `employee-standards.md` Section 5: 搜索规则补充排除目录（node_modules/、vendor/、__pycache__ 等），调试依赖时除外
- `employee-standards.md` Section 6: E2E 步骤补充注——Healer 需要 Playwright 环境，非 Node.js 项目参考各自语言集成
- `.claude/skills/openspec-e2e/SKILL.md`: 明确 scope 为 Node.js + TypeScript + Playwright 项目；Step 4 前增加 gstack 可用性检查（不可用则 STOP 并提示安装）；Step 8 BASE_URL 检测扩展支持 Python (pyproject.toml/uvicorn) 和 Go (main.go/.env)

### Added

- `employee-standards.md` Section 3: Add **上下文压缩恢复后** rule — after context compression in Apply phase, must check `git status` and re-read `proposal.md` + `tasks.md` before continuing

## [0.3.22] - 2026-04-22

### Changed

- `employee-standards.md` Section 4: Restructured implementation phase with 4 new subsections:
  - **4.1 变更边界检查**: Before/during/after scope validation against proposal.md
  - **4.2 任务类型区分**: Build/Verify/Dependent task completion criteria
  - **4.3 依赖链检查**: Check predecessor status before marking dependent tasks
  - **4.4 自动化 Gate**: Auto-run lint + typecheck, fail-fast
  - **4.5 Verify 强制化**: Must pass verify before marking complete
- Removed redundant "5. 自审" section (covered by 4.5)
- Renumbered workflow steps (removed old step 5, E2E now step 5)

## [0.3.19] - 2026-04-19

### Changed

- `employee-standards.md` Section 2: Refined code quality principles — "Surgical Changes" (only modify what's asked, clean up own mess), "Simplicity" (50-line solution in 50 lines, not 200), explicit search rule (Grep + Glob, scope defaults to all source types)
- `employee-standards.md` Section 5: Strengthened search rule — requires both content search (Grep) and filename search (Glob), scope defaults to all source types, explicit coverage of refactoring scenarios

### Docs

- Clarified release flow: CI handles npm publish, local `npm publish` is forbidden

## [0.3.18] - 2026-04-17

### Fixed

- `package.json` bin: Changed from `./bin/openspec-pw` (Unix shell) to `./bin/openspec-pw.js` (Node.js) — fixes "The system cannot find the path specified" on Windows
- `bin/openspec-pw.js`: Added CWD preservation logic (save orig CWD → set env var → chdir to pkg root → restore on exit/SIGINT/SIGTERM) so `openspec-pw init` works correctly from user project directories on Windows

## [0.3.15] - 2026-04-16

### Added

- `src/utils/ollama.ts`: Vision Check config now reads from `tests/playwright/.env` (highest priority) and environment variables. No longer requires `app-knowledge.md` section.
- `src/utils/ollama.ts`: Enhanced VISION_PROMPT — adds QA engineer role, 2 new defect types (missing/incorrect), explicit exclusion rules, and clear severity definitions.
- `openspec-pw vision-check`: Three new capabilities:
  1. **Multi-viewport**: `--viewport mobile,tablet,desktop --url http://localhost:3000` captures and analyzes at multiple screen sizes
  2. **Pixel diff + baseline**: `--baseline` saves baseline screenshots; `--diff` compares with baseline using pixelmatch + VLM to detect semantic regressions
  3. **HTML report**: `--report <path>` generates a self-contained HTML report with embedded screenshots, anomaly summaries, and severity breakdown

### Fixed

- `src/utils/ollama.ts`: Fixed regex `\z` → `$` — JavaScript `\z` anchor never matches inside a lookahead

- `bin/openspec-pw`: Restore caller's working directory after node exits — `openspec-pw init --seed` now works correctly from user project directories
- `src/index.ts`: Read `OPENSPE_PW_CWD` env var and `chdir()` at startup to restore original CWD

## [0.3.14] - 2026-04-16

### Fixed

- `openspec-pw update`: Sync `openspec-playwright` in `devDependencies` when running from a project that has it as a local dependency

## [0.3.13] - 2026-04-16

### Changed

- `employee-standards.md` Section 2: Integrated LLM coding best practices — think before acting, goal-verification loops, refuse "good enough" code

## [0.3.12] - 2026-04-16

### Fixed

- `bin/openspec-pw`: Resolve symlinks to find real script location for global installs

## [0.3.11] - 2026-04-16

### Changed

- `bin/openspec-pw`: Correct CLI bin entry point to shell wrapper

## [0.3.10] - 2026-04-16

### Added

- Re-release of the vision-check feature set under the corrected version number after npm publish conflict

- `openspec-pw vision-check` command: Analyze screenshots for layout anomalies using Ollama VLM (Vision Language Model)
  - `--screenshots <pattern>` — Glob pattern or comma-separated list of screenshot paths (required)
  - `--parallel <n>` — Concurrent Ollama requests (default: 4)
  - `--severity <levels>` — Filter by severity: `blocking,warning,minor`
  - `--output <path>` — Write JSON results to file
  - `--dry-run` — List screenshots without analyzing
  - `--json` — Output JSON format
  - Exit codes: `0` = completed, `1` = Ollama unavailable (skip), `2` = disabled in config (skip)
- `src/utils/ollama.ts`: Ollama API wrapper with health check, batch analysis, and graceful degradation
- `openspec-pw doctor`: New "Vision Check" health check item — shows Ollama availability and configured vision model
- SKILL.md Step 4.5: Vision Check workflow — optional VLM-powered layout anomaly detection after exploration, before test generation
- `templates/app-exploration.md`: New "Visual Anomalies" section — auto-populated by `vision-check` command with de-duplication
- `templates/app-knowledge.md`: New "Vision Check Config" section — project-level Ollama configuration (url, model, enabled)

### Changed

- Vision Check configuration supports 2-tier priority: env vars (`OLLAMA_URL`, `OLLAMA_VISION_MODEL`) → `app-knowledge.md`. No config = disabled.
- Vision Check is optional and non-blocking — Ollama unavailable or disabled simply skips the check, workflow continues

### Dependencies

- Added `glob` package for screenshot path resolution

## [0.3.8] - 2026-04-15

### Changed

- `.claude/skills/openspec-e2e/SKILL.md`: Require explicit `/opsx:e2e` or 'run E2E tests' trigger in SKILL.md description to prevent automatic invocation of E2E from other stages (explore/propose/apply/verify/continue).

## [0.3.7] - 2026-04-14

### Added

- `templates/global.teardown.ts`: Post-test cleanup template for database/file/cache/cache cleanup with project dependencies pattern (Playwright recommended approach)
- SKILL.md: New "Setup / Teardown" section with comparison table, implementation guidance, and teardown enablement instructions
- `playwright.config.ts`: Pre-configured teardown project (commented, ready to enable)
- README.md: Test Assets tree updated to include `global.teardown.ts`

### Fixed

- `employee-standards.md`: Removed reference to non-existent `/frontend-design` skill
- SKILL.md: Architecture section — clarified spec files are independent per change; added explicit opt-in warning for full regression
- SKILL.md: Title "Global Setup/Teardown" renamed to "Setup / Teardown" for accuracy
- `templates/playwright.config.ts`: Streamlined teardown comment block

### Changed

- `src/commands/init.ts`: `generateSeedTest`, `generateAppKnowledge`, `generateSharedPages`, `installSkillTemplates` now exported for use by other commands

## [0.3.6] - 2026-04-14

### Added

- SKILL.md v2.25: Complete Healer workflow redesign — Phase 1 Triage → Phase 2 Repair → Phase 3 Escalate replaces the original decision table
  - Phase 2 restructured into sub-steps: Phase 2-0 (batch diagnosis, no browser), Phase 2-1 (assertion fix with explicit EXPECTED vs ACTUAL comparison), Phase 2-5 (selector repair with stability ranking), Phase 2-5a/2-5b, Phase 2-6 (incremental per-test verify + targeted `--grep`), Phase 2-7 (logging with auto-de-duplicate)
  - **Phase 2-6 loop deadlock fixed**: failure type now routes to correct sub-step (assertion → Phase 2-1, selector → Phase 2-5, timeout → Flaky retry)
  - **Batch Detection**: multiple failing tests with same root cause now share one App Bug entry (not N bugs)
  - **Batch Detection Timeout handling**: now retry one isolated before labeling RAFT
  - **KNOWN_FIX shortcut**: Phase 2-0 diagnosis with `KNOWN_FIX=yes` jumps directly to Phase 2-6 using Selector Fixes table entry
  - **"same error pattern" rule**: Batch Detection now requires same root cause (console/network confirmed), not just same error type
  - **Phase 3 decision tree**: explicit 4-option (a/b/c/d) with per-choice actions and re-run instructions
  - **Global attempt guard**: per-test independent heal counter (≤3), no reset on Flaky retry
  - **Auto-de-duplicate** in Step 4.6 and Phase 2-7: composite keys prevent duplicate rows across multiple change runs
  - Graceful Degradation table: 4-column (Scenario / Classification / Action / Workflow Status)

### Fixed

- `src/commands/run.ts`: `--grep` + `--smoke` combined now correctly produces order-flexible AND pattern (all regex chars escaped)
- `templates/app-knowledge.md`: Added **Assertion Fixes** table; assertion modification guidance
- `templates/pages/BasePage.ts`: Timing fixes for React 19 concurrent mode
- `templates/playwright.config.ts`: storageState path now correctly resolves relative to cwd=projectRoot
- SKILL.md markdown: 7 instances of `| — |` fixed to `| --- |`
- SKILL.md selector priority corrected: `getByRole` > `getByLabel` > `getByPlaceholder` > `getByText` > `getByTestId`

## [0.3.4] - 2026-04-13

### Fixed

- `src/commands/editors.ts`: `installProjectClaudeMd` now replaces content inside OPENSPEC:START/END markers on every run (previously skipped if markers existed, leaving stale content forever)
- `openspec-pw update`: now syncs employee-grade standards to project CLAUDE.md alongside skill/commands/templates
- SKILL.md: removed space between `/` and command name in step tags
- Added `*.tgz` to `.gitignore`; removed stale tgz artifacts from repo root

### Added

- `scripts/bump-docs.js`: auto-updates version badge in `docs/index.html` on release
- `npm run release` now runs bump-docs.js before build/publish

## [0.3.2] - 2026-04-13

### Changed
- `employee-standards.md`: trim redundant content — removed Playwright MCP installation detail, "Claude Code auto-dispatch" boilerplate, arbitrary "3 edits max" rule, gstack skill enumeration, CSS audit code block, feedback loop table; streamlined workflow step descriptions; simplified title and header.

## [0.3.1] - 2026-04-12

### Added
- `openspec-pw explore` command: parallel route exploration via N independent Chromium workers, each with its own browser context (no shared state). `--parallel <n>` sets worker count (default 4, max 16). `--dry-run` previews chunk assignment. Built-in auth redirect detection (compares final URL vs expected URL to flag protected routes), atomic write with backup, lock file to prevent concurrent runs, SIGINT/SIGTERM cleanup handlers.
- CLI: `openspec-pw run --smoke` to run only smoke tests (`--grep @smoke`)
- CLI: `openspec-pw run -w/--workers <n>` to control parallel worker count
- CLI: `openspec-pw run --grep` combined with `--smoke` produces AND pattern (all regex chars escaped)
- SKILL.md Step 4.5: Route Snapshot Hash — sitemap.xml hash to skip unchanged routes on re-runs
- SKILL.md Step 6: Selector Caching — reuse Step 4 exploration selectors in test generation (~30-50 fewer navigations per 50-test suite)
- playwright.config.ts: CI workers default raised to 4 (from 1)

### Fixed
- SKILL.md Step 4.2: removed broken `Promise.allSettled` + `$B` parallel approach (caused data pollution due to shared Chromium instance). Replaced with `openspec-pw explore` redirect.
- `openspec-pw explore`: added auth redirect detection (prevents HTTP 200 + login page being reported as "ok"), atomic write with backup, lock file (30min TTL + stale-lock auto-detection), signal handlers, max workers cap.
- `openspec-pw explore` lock file: stale locks (>30min) are auto-removed; process.alive check via `kill(pid, 0)` prevents false "already locked" errors from crashed processes.
- `openspec-pw run`: `--grep` and `--smoke` now combine into AND pattern with full regex escaping (previously last flag won, silently dropping the other).

### Performance
- **Healer Phase 2**: batch diagnosis first (read specs + app-knowledge.md, no Playwright overhead), then apply ALL fixes + single `--workers=1` run for all Phase 2 tests as one combined grep. Eliminates N×M Playwright startups where N=failures, M=heal attempts. Estimated ~15-20s saved per eliminated startup.
- **Healer Phase 2**: `--workers=1` sequential isolated execution eliminates data races from shared Playwright state (previously parallel workers polluted each other's state causing cascading failures).
- **Parallel exploration**: 4 workers default (up to 16) — each worker launches independent Chromium, true parallelism vs sequential single-process. Estimated exploration time reduced by ~3-4x.

## [0.3.0] - 2026-04-12

### Changed
- `employee-standards.md`: complete rewrite — add 6-chapter structure (适用范围、浏览器操作约束、代码质量、上下文管理、大规模任务处理、工具限制与编辑安全) + 完整生产工作流（含步骤详解 + 反馈循环表）；4轮深度检查后 P0/P1 问题全部修复

- `SKILL.md` v2.24: Mock Data Rule 大幅扩展 — Frontend mocking 禁止（禁止 mock JS 变量/组件状态，否则隐藏真实集成问题）；API mocking 仅限 HTTP 层（`page.route()` 拦截，不能 mock 数据库/后端服务）；使用前必须用户授权（列 reason + endpoint + expected behavior）；业务计算类断言必须用 API 验证（余额、总数、折扣等）；移除 5 处模板路径引用（模板已通过 `openspec-pw init/update` 同步到项目本地）；test-plan.md 的 test case 如需 API mock 则标记 `⚠️ API Mock`

- `docs/index.html`: Hero 按钮布局修复 — `.hero-desc` 和 `.hero-actions` 同处 grid row 3 导致 margin-bottom:36 + margin-top:80 = 116px 间隙；改为 grid 行 4 分离；`employee-standards.md` Step 5 同步 CSS 审计步骤

- `employee-standards.md`: Step 5 CSS 审计升级为两步式框架感知方法 — 1) 确定间距基准 → grep 提取值对比基准，列低于基准的项；2) 检查 margin hack（同一 grid/flex 容器中相邻元素 margin 和 > 基准 2 倍 → 改为 grid 行或 gap 控制）；移除写死的阈值数字；描述精简（14 行→7 行）

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
