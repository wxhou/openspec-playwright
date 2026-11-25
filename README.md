# OpenSpec + Playwright E2E Verification

[中文说明](./README.zh-CN.md)

[![npm version](https://img.shields.io/npm/v/openspec-playwright.svg)](https://www.npmjs.com/package/openspec-playwright)
[![npm downloads](https://img.shields.io/npm/dm/openspec-playwright.svg)](https://www.npmjs.com/package/openspec-playwright)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node >= 22](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](https://nodejs.org)

**OpenSpec projects get AI-driven E2E verification that lives where your code does.** One `/openspec-e2e <change>` command — sixteen editors supported — plans, generates, executes, and self-heals Playwright tests against the spec, with a per-change report and no manual harness wiring.

> **Why this exists**: spec-driven development without test automation is a half-finished loop. This tool completes it — write a change spec, run one command, get tests traceable to spec anchors and a report on what passed, what healed, and what is left for human review.

## Contents

- [Install](#install)
- [Setup](#setup)
- [Supported AI Coding Assistants](#supported-ai-coding-assistants)
- [Usage](#usage)
- [Prerequisites](#prerequisites)
- [Init Modes: frontend vs minimal](#init-modes-frontend-vs-minimal)
- [How It Works](#how-it-works)
- [CLI Commands](#cli-commands)
- [Selecting Editors on Init](#selecting-editors-on-init)
- [Managed `.gitignore` paths](#managed-gitignore-paths)
- [Official Playwright Agents](#official-playwright-agents)
- [What `openspec-pw init` Does](#what-openspec-pw-init-does)
- [`openspec-pw doctor` Checks](#what-openspec-pw-doctor-checks)
- [App Server Detection](#app-server-detection)
- [Authentication](#authentication)
- [Customization](#customization)
- [Architecture](#architecture)
- [License](#license)

## Install

```bash
npm install -g openspec-playwright@latest
```

> npm is the supported installation channel. Global installs via pnpm/bun/yarn are not supported — `openspec-pw update` self-updates through `npm install -g`, which would create a second, conflicting install.

## Setup

```bash
# In your project directory
npm install -g @fission-ai/openspec@latest
openspec init --scope project  # 2.x keeps skills in the repo; on a 1.x CLI run: openspec init
openspec-pw init          # Install Playwright E2E integration (--tools to pick editors, --agents for the official agents)
```

Then, once per project:

1. `npx playwright install chromium` — on Linux CI images add `--with-deps`; on macOS run `xcode-select --install` first if the install fails.
2. Start your dev server (`npm run dev`) in a separate terminal; set `BASE_URL` if the app is not on the detected port.
3. `npx playwright test tests/playwright/seed.spec.ts` validates the environment — if it fails, check `webServer` in `playwright.config.ts`.
4. Run `/openspec-e2e <change-name>`; reports land in `openspec/reports/`. Configure auth first if the app needs login ([Authentication](#authentication); debug with `npx playwright test --project=setup`).

## Supported AI Coding Assistants

Naming follows the installed OpenSpec major: the table below uses the 2.x names; on 1.x the same products install `opsx-e2e` artifacts at `opsx-` paths (for example `.claude/commands/opsx/e2e.md`) and invoke them as `/opsx:e2e` in Claude Code, CodeBuddy CLI, and Gemini CLI, `/opsx-e2e` elsewhere, `$opsx-e2e` in Codex, and `/skill:opsx-e2e` in Kimi Code.

| Editor | Command | Artifact | Playwright MCP | AGENTS.md hook |
|---|---|---|---|---|
| **Claude Code** (Anthropic) | `/openspec-e2e <change-name>` | `.claude/skills/openspec-e2e/SKILL.md` + shared `.agents/skills/openspec-e2e/SKILL.md` | yes (project `.mcp.json`) | via `CLAUDE.md` → `@AGENTS.md` |
| **OpenCode** (SST) | `/openspec-e2e <change-name>` | `.opencode/commands/openspec-e2e.md` | yes (`opencode.jsonc`) | `instructions` field |
| **Cline** | `/openspec-e2e <change-name>` | `.cline/skills/openspec-e2e/SKILL.md` | yes (`.cline/mcp.json`) | native |
| **Cursor** | `/openspec-e2e <change-name>` | `.cursor/commands/openspec-e2e.md` + `.cursor/skills/openspec-e2e/SKILL.md` | yes (`.cursor/mcp.json`) | native |
| **Pi** (earendil-works) | `/openspec-e2e <change-name>` | `.pi/prompts/openspec-e2e.md` (filename = command) | **no MCP client** — `openspec-pw explore` + `npx playwright test`, no Healer step | native |
| **Oh My Pi (omp)** | `/openspec-e2e <change-name>` | `.omp/commands/openspec-e2e.md` | yes (`.omp/mcp.json`) | native |
| **CodeBuddy CLI** (Tencent) | `/openspec-e2e <change-name>` | `.codebuddy/commands/openspec-e2e.md` | yes (project `.mcp.json`) | via `CODEBUDDY.md` → `@AGENTS.md` |
| **MiniMax Code** (`mcode` CLI) | `/openspec-e2e <change-name>` | `.agents/skills/openspec-e2e/SKILL.md` (skill) | yes (project `.mcp.json`) | native (`AGENTS.md`) |
| **DeepSeek Harness** (`dsh`) | `openspec-e2e` skill | `.dsh/skills/openspec-e2e/SKILL.md` (skill) | **no project-level carrier** — configure Playwright MCP in your `$DSH_HOME` profile patch | native (`AGENTS.md`) |
| **Gemini CLI** | `/openspec-e2e <change-name>` | `.gemini/commands/openspec-e2e.toml` (TOML) | yes (`.gemini/settings.json`) | `GEMINI.md` |
| **Qwen Code** | `/openspec-e2e <change-name>` | `.qwen/commands/openspec-e2e.md` | yes (`.qwen/settings.json`) | `QWEN.md` |
| **GitHub Copilot** (VS Code) | `/openspec-e2e <change-name>` | `.github/prompts/openspec-e2e.prompt.md` | yes (project `.mcp.json`) | `.github/copilot-instructions.md` |
| **Roo Code** | `/openspec-e2e <change-name>` | `.roo/commands/openspec-e2e.md` | yes (`.roo/mcp.json`) | `.roo/rules/openspec-pw.md` |
| **Trae** | `/openspec-e2e <change-name>` | `.trae/commands/openspec-e2e.md` | yes (`.trae/mcp.json`, Project MCP beta) | `.trae/rules/project_rules.md` |
| **Codex** | `$openspec-e2e <change-name>` | `.agents/skills/openspec-e2e/SKILL.md` (skill) | **no JSON carrier** — project MCP lives in `.codex/config.toml` (TOML, not supported) | native (`AGENTS.md`) |
| **Kimi Code** | `/skill:openspec-e2e <change-name>` | `.kimi-code/skills/openspec-e2e/SKILL.md` (skill) | yes (`.kimi-code/mcp.json`) | native (`AGENTS.md`) |

## Usage

The command body is identical across editors; only the name and artifact location differ. Invoke it with a change name, e.g. `/openspec-e2e add-checkout` (`$openspec-e2e add-checkout` in Codex, `/skill:openspec-e2e add-checkout` in Kimi Code). Per-editor MCP, detection, and auth details are in [Prerequisites](#prerequisites).

<details>
<summary><strong>Per-editor nuances</strong> (expand only if init reports a divergence)</summary>

- **Cursor**: skill uses `disable-model-invocation: true` (only runs when explicitly invoked). If you want Cursor support but have no `.cursor/` yet: `mkdir -p .cursor`.
- **Oh My Pi**: also inherits MCP servers already configured in `.claude/` / `.cursor/` / `opencode.jsonc` when those are present.
- **MiniMax Code**: skills are the only user-extensible command mechanism in the `mcode` CLI, which loads no user-defined command files. **Integration target is the `mcode` CLI; the desktop app is not covered.**
- **DeepSeek Harness**: `.dsh/skills` is dsh's rank-100 project root, so it beats the `.agents/skills` copy a MiniMax setup leaves behind. Developer preview — the adapter relies only on its documented skill-discovery contract.
- **GitHub Copilot**: targets the VS Code surface — MCP entries are `stdio` and shared with Claude/CodeBuddy/MiniMax; detection uses Copilot-specific markers only, so a plain `.github/` directory in any repository does not count.
- **Roo Code**: Roo loads every file in `.roo/rules/`.
- **Trae**: Project MCP is beta — older IDE builds may ignore `.trae/mcp.json`.
- **Codex**: the skill directory is shared with MiniMax Code, so deselecting Codex keeps the skill while MiniMax stays selected; browser exploration falls back to `openspec-pw explore` and `npx playwright test`.
- **Kimi Code**: Kimi's automatic `AGENTS.md` loading is not documented, so treat that hook as unverified.

</details>

### Selecting Editors on Init

<details>
<summary>Pre-select logic, deselect = remove, editor territory</summary>

`openspec-pw init` normally auto-detects the editors in your project and
configures all of them. To install only a subset (or none), use `--tools` —
matching the semantics of `openspec init --tools`:

```bash
openspec-pw init --tools claude,cursor   # only Claude Code and Cursor
openspec-pw init --tools all             # every supported editor
openspec-pw init --tools none            # no editors; scaffold only
```

Supported ids: `claude`, `opencode`, `cline`, `cursor`, `pi`, `omp`,
`codebuddy`, `minimax`, `dsh`, `gemini`, `qwen`, `github-copilot`,
`roocode`, `trae`, `codex`, `kimi` (`oh-my-pi` is accepted as an alias for
`omp`, `minimax-code` for `minimax`). Ids are
case-insensitive, repeats are de-duplicated, and `all`/`none` cannot be
mixed with specific ids. A `--tools` id is configured even when the editor
is not detected (its config directory is created).

Without `--tools`, a TTY shows a multi-select grouped as `Configured` / `Detected` / `Other`: editors this project already uses are pre-checked, editors installed globally but unused are listed unchecked, and a first-run project pre-checks only project-level signals (root `CLAUDE.md`, `.cursorrules`, `opencode.json(c)`, `CODEBUDDY.md`). `--tools` picks *which* editors; `--no-mcp` decides *whether* their Playwright MCP server is installed.

**Standards language.** `init --lang zh|en` selects the language of the AGENTS.md standards block; without the flag, an installed block's language wins, then the OS locale, then the terminal locale, then English. `update --lang` switches an installed block. IP and region are never detected.

Init prints a pre-select hint (not the install set) and a `Selected editors:` line (the actual install set).

**Choosing what to ignore.** Interactive init lists the managed `.gitignore` paths as four group toggles (three with `--auto-pipeline`, which keeps `openspec/` committable), all checked — Enter keeps them ignored; unchecking a group commits every path in it, and the "Customize" row opens the per-path list. Committed paths are recorded on the block's `# openspec-pw: skip=…` line, so `update` leaves them out and a later init can restore an exactly recorded path. An opt-out for a path inside a managed directory keeps that whole directory committable — git cannot re-include a file under an ignored directory — and the directory stops being offered. Rule files are always injected (use `--no-rule-files` to install only AGENTS.md). Non-interactive runs keep the previous choices; a fresh project ignores everything managed.

**Deselect = remove.** In interactive init, deselecting a detected editor offers to delete its openspec-pw products (one confirmation). Only tool-owned territory is touched — your own config entries and edited vendored agents stay. A shared `.mcp.json` entry is kept while another selected editor (Claude Code, CodeBuddy, MiniMax, Copilot) still reads that file. `--tools` and non-TTY runs never remove anything.

**Editor territory**: `update` only maintains editors already configured in the project; to add one, run `openspec-pw init --tools <id>`.

</details>

### Managed `.gitignore` paths

The block itself lists all 40 paths it covers (local data and credentials, editor commands and directories, MCP config, OpenSpec artifacts, and the always-ignored rule files) — open `.gitignore` to see them. Editor roots are ignored whole, so your own files under them (e.g. `.agents/skills/team-skill/`) need `git add -f`. If the block cannot be written, a warning lists the uncovered paths. Ignore rules do not apply to already-tracked files: if credentials were committed before, run `git rm --cached tests/playwright/credentials.yaml`.

### Init Modes: frontend vs minimal

`openspec-pw init` picks an install mode from the frontend signal
(`vite/next/nuxt/...` config files > framework dependencies > `dev` script
keywords > monorepo workspace members):

- **frontend mode** (signal hit): the full Playwright scaffold — e2e
  command, seed test, `BasePage`, test plan, `playwright.config.ts`, auth
  setup, credentials, MCP gate, agents gate.
- **minimal mode** (no signal, or no readable `package.json` — e.g.
  Python/Go backends): only a `tests/README.md` describing the
  acceptance-test contract (real requests against a real running service,
  framework of your choice) plus the employee-grade standards block. No
  Playwright scaffold, no e2e command, no MCP, no agents.

The Summary prints the mode and its basis (`Mode: frontend (signal:
vite.config.ts)` / `Mode: minimal (no frontend signal)`), so a misjudgment
is visible on the spot. Detect blind spots (frontend in an untracked
subdirectory; `vite.config.ts` hosting only vitest) are covered by an
explicit override:

```bash
openspec-pw init --frontend      # force the full scaffold despite no signal
openspec-pw init --no-frontend   # force minimal mode despite a hit
```

Later, `--frontend` (or a newly detected signal) adds the full scaffold incrementally and prunes the untouched `tests/README.md`; minimal projects stay supported by `update`, `doctor`, and `remove`.

### Mini-Program Target

`init` can scaffold E2E for a WeChat mini-program instead of a web app. The
target is a separate dimension from the install mode: a mini-program project
is always frontend mode.

Detection looks for `project.config.json`, a built `mp-weixin` output, `@tarojs/*` / `@dcloudio/*` dependencies, or a genuine `app.json` (with `pages` and a companion file); override with `--miniprogram` / `--no-miniprogram`. After generation, `update` / `remove` / `doctor` follow the generated artifacts (`wxa-test.ts` or `wxaProject`) instead of re-detecting, and re-running `init --miniprogram` over a web scaffold stops with a migration instruction instead of a half-converted project.

The scaffold uses the official [`@open-wxa/wxa-runner-playwright`](https://open-wxa.github.io/wxa-runner/) fixture: the `wxa-test.ts` wrapper, `wxa.setup.ts` (auth state lives here — no `auth.setup.ts` or `credentials.yaml`), a Chrome-channel `playwright.config.ts`, and a seed test. Dependencies: `@playwright/test@^1.65`, `@open-wxa/wxa-runner-{playwright,core}@^0.13`, `wxa-runner@^0.13`, and Chrome (`npx playwright install chrome`). Generated CI installs Chrome and runs the app build (`build:weapp` for Taro, `build:mp-weixin` for uni-app) before the tests.

Limitations: tests run in headless Chrome, not WeChat DevTools. DevTools-only
APIs (real login, payment, native components) are outside the harness. CI
support targets x86-64 Linux; there is no WebKit or Firefox project. Taro
projects resolve and build, but Taro's own runtime may fail to initialize in
the browser runner (`没有找到页面实例`); run the seed first and treat a
failing seed as that app being unsupported, not as a reason to write specs.

### Official Playwright Agents

<details>
<summary>opt-in <code>--agents</code> — what gets vendored and how updates treat it</summary>

```bash
openspec-pw init --tools claude --agents   # additionally install the official planner agent
```

`--agents` (off by default) vendors one byte-identical snapshot of Playwright's official `init-agents` output into `.claude/agents/`: `playwright-test-planner.md`, which explores the app and drafts the test plan (delegable for context isolation). The official `generator` and `healer` agents are deliberately not installed — generation runs inside the pipeline, and the official healer edits assertions to force green, the opposite of the honest-failure exit the Healer step keeps.

Ownership is content-based: unmodified snapshots are refreshed by `update` and removed by `remove`, edited copies are never overwritten or deleted, and `doctor` warns (non-blocking) when their `playwright-test` MCP entry is missing. Init asks once (default No); minimal-mode projects skip agents along with MCP.

> **Running `npx playwright init-agents` yourself is clobber-type**: it rewrites `.mcp.json` wholesale (your own entries are destroyed) and creates a parallel `opencode.json`. Run it *before* `openspec-pw init` if you must, and check `git diff .mcp.json`. With `--agents` you don't need it.

</details>

### CLI Commands

```bash
openspec-pw -v            # Print version (also -V / --version)
openspec-pw init          # Initialize integration (--tools all|none|ids… to select editors; --agents adds the official agents; --frontend/--no-frontend force the install mode; --miniprogram/--no-miniprogram select the mini-program target; --rule-files/--no-rule-files toggle per-editor rules copies; --lint-config generates/extends ESLint and ruff config for the swallow-error checklist; --hook[=static|full] installs a Claude Code Stop hook; --auto-pipeline generates the headless CI workflow; --lang zh|en selects the employee-standards language)
openspec-pw update        # Update CLI and commands to latest version (--lang zh|en switches an installed standards block)
openspec-pw doctor        # Check prerequisites (Node, Playwright, OpenSpec, config, tests) + app server diagnostics
openspec-pw install --claude # Install or verify Claude Code via the official native installer (default: print only; --run executes; --verify checks)
openspec-pw audit         # Audit tests for orphaned specs and issues (--gate exits 1 when any issue is found)
openspec-pw coverage      # Analyze spec–test coverage for changes (--fail-under <pct> exits 1 below it; --plan <file> exits 1 unless every delta-spec scenario appears in that plan)
openspec-pw flake         # Detect flake patterns in test files (static patterns + raised timeouts)
openspec-pw gate [change] # Run every quality check and exit 0 / 1 / 2 (pass / fail / cannot decide; --repeat N reruns failed E2E tests to classify flaky vs real)
openspec-pw migrate       # Migrate old test files to new structure
openspec-pw explore       # Explore app routes with Playwright (--file <path> selects app-exploration.md)
openspec-pw remove        # Remove integration (--all scans home + Windows drives; asks before removing on a TTY, --yes skips)
```

`install --claude` prints the official native installer command (`--run` executes it, `--verify` checks an existing install, `--channel stable|latest`, `--version x.y.z`). It uses official Anthropic channels only — no mirrors, proxies, or region workarounds.

**`remove`** deletes only tool-owned artifacts (editor commands, MCP entries, rules blocks, the managed `.gitignore` block, hooks, the schema, the lint checklist, vendored agents) plus template files still byte-identical to the bundled copies. Your own files, `tests/**`, `credentials.yaml`, and `openspec/specs` are never touched; edited tool files are kept with a notice; paths that resolve outside the project through a symlink are skipped.

`remove --all` scans your home directory (every drive root on Windows) for projects holding any of those artifacts. It lists the plan first: on a TTY it asks once before deleting, `--yes` skips the question, and non-TTY runs only print the plan. `--root <dir>` (repeatable) replaces the scan roots. One project's failure never stops the rest; the run ends with `removed N / skipped M / failed K` and a non-zero exit when anything failed.

`openspec-pw gate` runs `validate → lint → typecheck → test → flake → e2e`, stops at the first failure unless `--keep-going`, and exits `0` / `1` / `2` (pass / fail / cannot decide). It also fails a change that declares scenarios but has no E2E tests, and any newly added `test.fixme(`; edits to lint/TS/Playwright configs and raised timeouts are reported under `flags`, not failed.

**Runtime flake evidence.** `gate --repeat <N>` reruns only the E2E tests that failed on the first run (`--retries=N`). Tests that pass at least once are listed as flaky and do not fail the gate unless `--strict-flake` is given. Playwright artifacts land in `tmp/gate-flake-*`. `--hook` cannot be combined with `--repeat`.

**Stop hook.** `init --hook` installs a Claude Code Stop hook that runs `gate --hook`: `static` (default) or `full` (adds flake and e2e — use it only once the change's E2E tests exist). A red gate exits 2, so the agent keeps working instead of claiming done. `--no-hook` or `remove` takes it out; your own hooks are untouched.

**Autonomous pipeline.** `init --auto-pipeline` writes `.github/workflows/openspec-auto.yml` once and never overwrites it. Every pull request runs `gate` only — mark that job a **required status check** — while an `openspec:auto` label or manual dispatch starts the headless agent (apply → static gate → generate E2E → full gate) and opens the PR. Required secret: `ANTHROPIC_API_KEY`; authenticated apps also need `E2E_USERNAME` / `E2E_PASSWORD` secrets and the `E2E_AUTH_*` variables. Stages run cheapest-first; apply is judged by `openspec list --json` task counts, and the final verify pass is advisory. Because CI checks out the repository, `openspec/` must stay committed in pipeline projects.

## How It Works

### Spec anchors & stale-test audit

Every test the Generator writes carries a **spec anchor** — one comment line above each `test()`:

```typescript
// spec: coupon#优惠券七天后过期
test('coupon expires after 7 days', async ({ page }) => { ... });
```

The anchor's `<capability>#<requirement>` uses the requirement's **exact title text** from the delta spec (no slug conversion), so `openspec-pw audit` can check it against the live main spec. The audit flags a requirement that no longer exists (retire candidate), a change name used as the capability (generator slip — fix the anchor), and a missing capability directory (likely rename); anchor-free tests are listed as info, and `test.fixme` tests are skipped. Audit is **report-only** — it never deletes or edits tests.

<details>
<summary><strong>Workflow tree</strong> — 10 steps from change selection to per-change report</summary>

```
/openspec-e2e <change-name>          # Codex `$openspec-e2e`, Kimi `/skill:openspec-e2e`
/openspec-e2e <change-name> --auto   # headless — no human checkpoint (see Autonomous pipeline)
  │
  ├── 1. Select change → read openspec/changes/<name>/specs/
  │
  ├── 2. Detect auth → check specs for login/auth markers
  │
  ├── 3. Validate env → run seed.spec.ts
  │
  ├── 4. Explore app → browser exploration (Playwright MCP / `openspec-pw explore`)
  │       └─ Write app-exploration.md; extract shared patterns → app-knowledge.md
  │
  ├── 5. Planner → generates test-plan.md
  │
  ├── 6. Generator → creates tests/playwright/changes/<name>/<name>.spec.ts
  │
  ├── 7. Configure auth → auth.setup.ts (if required)
  │
  ├── 8. Configure playwright → playwright.config.ts
  │
  ├── 9. Execute tests → npx playwright test (Healer repairs failures via MCP)
  │
  └── 10. Report → openspec/reports/playwright-e2e-<name>-<timestamp>.md
```

The numbered steps are the same on OpenSpec 1.x; only the command name changes (see the [naming note](#supported-ai-coding-assistants)).

</details>

## Prerequisites

**Required:**

1. **Node.js >= 22**
2. **One or more supported editors** — see the [Supported AI Coding Assistants](#supported-ai-coding-assistants) table. Pi, Oh My Pi, MiniMax Code, DeepSeek Harness, Gemini CLI, Qwen Code, GitHub Copilot, Roo Code, Codex and Kimi Code are also detected via their global config dirs (`~/.pi/agent/`, `~/.omp/agent/`, `~/.minimax-code/`, `~/.dsh/`, `~/.gemini/`, `~/.qwen/`, `~/.copilot/`, `~/.roo/`, `~/.codex/`, `~/.kimi-code/`).
3. **OpenSpec** initialized — see [Setup](#setup) (1.x is supported too: install `@1` and run plain `openspec init`)
4. **Playwright MCP** (for test execution + Healer) — installed automatically by `openspec-pw init` when a frontend signal is detected (skipped for API-only projects — API tests use the `request` fixture), **project-scoped** (written to the editor's project file from the table above, never your global config):
   - `playwright-test` — the official `playwright init-agents` test-runner server: `{ "command": "npx", "args": ["playwright", "run-test-mcp-server"] }` under `mcpServers` (Claude Code: `claude mcp add --scope project` → project-root `.mcp.json`; `opencode.jsonc` nests it under `mcp`). CodeBuddy and MiniMax Code are written directly, never through their CLIs — CodeBuddy's `mcp` CLI starts a port-bound service that conflicts with running sessions.
   - Pi and DeepSeek Harness have no project-level MCP client; browser exploration uses `openspec-pw explore` instead.

> **OpenSpec 1.x and 2.x supported**: naming follows the installed major (see the [naming note](#supported-ai-coding-assistants)). `openspec-pw doctor` accepts both; 3.x is rejected.

> Project-scoped servers prompt for approval the first time they are used interactively (`claude mcp reset-project-choices` resets those choices).

> **Server name `playwright-test`**: this is the server Playwright's own `playwright init-agents` ships (same `npx playwright run-test-mcp-server` transport). It is **not** `@playwright/mcp` (a separate package registering as `playwright` with ~67 `browser_*` tools) — the test-runner is its superset, adding the structured `test_run` / `test_debug` / `test_list` tools the Healer loop uses. The two coexist; searching "Playwright MCP" usually surfaces `@playwright/mcp` docs.

## What `openspec-pw init` Does

1. Detects supported editors in the project — project markers, or the global config dirs listed under [Prerequisites](#prerequisites) — and picks up the editors already configured by openspec-pw (see [Selecting Editors on Init](#selecting-editors-on-init))
2. Installs the E2E command or skill for each selected editor (paths in the [Supported AI Coding Assistants](#supported-ai-coding-assistants) table)
3. Generates `tests/playwright/seed.spec.ts`, `auth.setup.ts`, `credentials.yaml`, `app-knowledge.md`, `test-plan.template.md`, `pages/BasePage.ts`, plus the project-root `lint-guidelines.md` swallow-error and docstring lint checklist (refreshed by `update` while unmodified, removed by `remove`)

> **`--lint-config` (opt-in)**: creates a minimal `eslint.config.mjs` (eslint 9+ projects with no config anywhere up to the git root) and extends the ruff config with a managed `extend-select = ["B904"]` block. Existing configs are never edited — a paste-ready snippet is printed instead.
4. Generates `playwright.config.ts` with automatic dev script and port detection (Vite/Next/Nuxt/Astro, `.env`, and `--port`)
5. Picks the install mode from the frontend signal (see [Init Modes](#init-modes-frontend-vs-minimal)); with none found, prints guidance in the Summary — run `openspec-pw init` in the app directory (monorepo), or use Playwright's `request` fixture for API-only projects

## What `openspec-pw doctor` checks

`openspec-pw doctor` verifies prerequisites and exits non-zero if any **required** check fails.

| Category | Required checks | Optional checks |
|---|---|---|
| **Node.js** | `node` version | `engines` compatibility |
| **npm** | `npm` availability | — |
| **Playwright Config** | config file exists (`ts`/`js`/`mjs`/`mts`) | — |
| **OpenSpec** | directory initialized, CLI major 1 or 2 | `.spec.md` count |
| **Playwright Browsers** | CLI version, Chromium downloaded | — |
| **Playwright Test** | `@playwright/test` installed | — |
| **Mini Program** | Chrome, wxa fixture, `@playwright/test` >=1.64, `wxaProject` output | — |
| **Playwright MCP** | server configured for each configured editor | `playwright-cli` on PATH |
| **Cursor E2E** | command + skill files when Cursor is configured | hint pointing at `init --tools cursor` |
| **Vendored Agents** | — | snapshots' presence and ownership |
| **Sync** | standards in sync when initialized | not initialized |
| **Tests** | `tests/playwright/` exists | `auth.setup.ts` presence, `storageState` file present |
| **Seed Test** | — | `seed.spec.ts` presence |
| **Lint** | — | swallow-error checklist coverage (semantic check when the linter can resolve its config, text probe otherwise) |
| **App Server** | — | dev script, base URL, reachability |
| **CodeGraph** | — | CLI availability, index presence, MCP installation |

Run with `--json` for machine-readable output.

## App Server Detection

<details>
<summary>Priority chain and existing-config handling</summary>

Generated `playwright.config.ts` automatically detects the app URL in this priority order:

1. `BASE_URL` environment variable
2. environment variables: `PLAYWRIGHT_PORT`, `E2E_PORT`, `VITE_PORT`, `PORT`
3. port flags in `package.json` scripts, e.g. `vite --port 5125`
4. `vite.config.*` `server.port`
5. `.env.local`, `.env.development`, `.env` (same env var names)
6. framework defaults: Vite `5173`, Astro `4321`, Next/Nuxt `3000`
7. `seed.spec.ts` `BASE_URL` constant
8. fallback: `http://localhost:3000`

Run `openspec-pw doctor` to see the detected dev script and base URL. If your project already has `playwright.config.ts`, `init` will not overwrite it — it prints patch hints for missing `webServer`, `testDir`, `storageState`, and setup-project wiring.

</details>

## Authentication

If your app requires login, set up credentials once, then all tests run authenticated automatically.

> **Credentials are ignored automatically** by the managed `.gitignore` block (see [Managed `.gitignore` paths](#managed-gitignore-paths)). Ignore rules do not apply to already-tracked files: if credentials were committed before, run `git rm --cached tests/playwright/credentials.yaml`. Alternatively keep them in the `E2E_USERNAME` / `E2E_PASSWORD` env vars.

```bash
# 1. (Optional) Edit test users for role-based tests
vim tests/playwright/credentials.yaml

# 2. Enable auth and set environment variables
export E2E_AUTH_REQUIRED=true # without it auth.setup.ts is skipped
export E2E_AUTH_METHOD=api # or ui
export E2E_AUTH_API=/api/auth/login # optional; this is the default
export E2E_USERNAME=your-email@example.com
export E2E_PASSWORD=your-password

# 3. Record login (one-time; UI login opens the browser)
npx playwright test --project=setup

# 4. All subsequent tests use the saved session
/openspec-e2e my-feature
```

Supports **API login** (preferred, cookie-based) and **UI login** (fallback, for token/localStorage auth). For multi-user tests (admin vs user), add multiple users in `credentials.yaml` and run `/openspec-e2e` (Codex `$openspec-e2e`, Kimi `/skill:openspec-e2e`) — it reads role labels from specs and users from `credentials.yaml`, then generates one setup per role. Each setup reads `E2E_<ROLE>_USERNAME` and `E2E_<ROLE>_PASSWORD` (role name uppercased; non-alphanumeric characters become `_`).

## Customization

### Customize seed test

Edit `tests/playwright/seed.spec.ts` to match your app's:
- Base URL
- Common selectors
- Page object methods

### Authentication credentials

Edit `tests/playwright/credentials.yaml`:
- Add one entry per role for role-based tests

Auth variables are shown in the quick start above; `E2E_AUTH_CHECK_PATH` optionally asserts a path after login, before the session is saved.

In CI, set the `E2E_AUTH_*` values as repository variables; the workflow passes them to the test step. For multi-user CI, add the per-role credential pairs as secrets and forward them in the workflow env — the shipped workflow forwards only `E2E_USERNAME` / `E2E_PASSWORD`.

## Architecture

<details>
<summary>Standards delivery and coexistence</summary>

Employee-grade standards live in **AGENTS.md** as the single source of truth; the hook column in the [Supported table](#supported-ai-coding-assistants) is how each editor reaches it. Claude Code needs CLAUDE.md to import it with `@AGENTS.md` (it does not read AGENTS.md by default): the `@` line may sit anywhere outside backticks/code blocks, and outside the OPENSPEC-PW markers. CodeBuddy prefers CODEBUDDY.md when both exist.

**Per-editor rules copies.** AGENTS.md is the only mandatory rules file; the wrapper and per-editor rules files are convenience copies. `init --no-rule-files` installs AGENTS.md and removes those copies (unless they hold user content outside the block); `init --rule-files` restores them. The choice is recorded on the managed `.gitignore` block's skip line and honored by later runs.

> **Coexisting with the official `@fission-ai/openspec` CLI**: its `openspec update` deletes root AGENTS.md/CLAUDE.md blocks wrapped in plain `OPENSPEC:START/END` markers. openspec-pw uses the exclusive `OPENSPEC-PW:` namespace, which that matcher cannot see; if a block was already wiped, `openspec-pw init` restores it.

</details>

## License

MIT
