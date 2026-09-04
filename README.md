# OpenSpec + Playwright E2E Verification

[中文说明](./README.zh-CN.md)

A setup tool that integrates OpenSpec's spec-driven development with Playwright's three-agent test pipeline for automated E2E verification.

## Install

```bash
npm install -g openspec-playwright@latest
```

> npm is the supported installation channel. Global installs via pnpm/bun/yarn are not supported — `openspec-pw update` self-updates through `npm install -g`, which would create a second, conflicting install.

## Setup

```bash
# In your project directory
openspec init              # Initialize OpenSpec
openspec-pw init          # Install Playwright E2E integration (--tools to pick editors, --agents for the official agents)
```

## Supported AI Coding Assistants

**Claude Code** (Anthropic) — E2E workflow is driven by the `/opsx:e2e` command using a browser exploration tool (Playwright MCP or `openspec-pw explore`) + Playwright MCP (test execution).

**OpenCode** (SST) — E2E workflow is driven by the `/opsx-e2e` command (hyphenated per OpenSpec convention) using the same browser exploration + Playwright MCP stack. Playwright MCP is configured under `mcp["playwright-test"]` in `opencode.jsonc`.

**Cline** — E2E workflow is driven by the `/opsx-e2e` skill (installed as `.cline/skills/opsx-e2e/SKILL.md`) using the same browser exploration + Playwright MCP stack. Playwright MCP is configured in `.cline/mcp.json` under `mcpServers["playwright-test"]`. Cline auto-detects `AGENTS.md` as project rules — no wrapper file needed.

**Cursor** — E2E workflow is dual-installed: slash command at `.cursor/commands/opsx-e2e.md` (plain markdown, `$1` = change name) and Agent Skill at `.cursor/skills/opsx-e2e/SKILL.md` (`disable-model-invocation: true`). Invoke `/opsx-e2e`. Playwright MCP is merged into `.cursor/mcp.json` under `mcpServers["playwright-test"]`. Cursor auto-detects `AGENTS.md`. Skill name is `opsx-e2e` (not OpenSpec's `openspec-*` skill prefix). If you want Cursor support but have no `.cursor/` yet: `mkdir -p .cursor`.

**Pi** (earendil-works) — E2E workflow is driven by the `/opsx-e2e` prompt template (installed as `.pi/prompts/opsx-e2e.md`; the filename becomes the command name). Pi has **no MCP client**, so browser exploration runs through `openspec-pw explore` and test execution through `npx playwright test` in the shell. Pi loads `AGENTS.md` natively — no wrapper file needed. Detected via a project `.pi/` dir or the global `~/.pi/agent/` config dir.

**Oh My Pi (omp)** — E2E workflow is driven by the `/opsx-e2e` command (installed as `.omp/commands/opsx-e2e.md`). Playwright MCP is configured in `.omp/mcp.json` under `mcpServers["playwright-test"]` (omp also inherits `.claude/`/`.cursor/`/opencode MCP configs when present). omp auto-detects `AGENTS.md` — no wrapper file needed. Detected via a project `.omp/` dir or the global `~/.omp/agent/` config dir.

## Usage

### In Claude Code

```bash
/opsx:e2e <change-name>
```

### In OpenCode

```bash
/opsx-e2e <change-name>
```

The command id is hyphenated per the OpenSpec convention; the body is rewritten from `/opsx:` to `/opsx-` during install and stored at `.opencode/commands/opsx-e2e.md`.

### In Cline

```bash
/opsx-e2e <change-name>
```

The skill is installed at `.cline/skills/opsx-e2e/SKILL.md` and triggered via the `/opsx-e2e` slash command. The body is rewritten from `/opsx:` to `/opsx-` during install.

### In Cursor

```bash
/opsx-e2e <change-name>
```

Installed as `.cursor/commands/opsx-e2e.md` plus `.cursor/skills/opsx-e2e/SKILL.md`. The command body is plain markdown (no frontmatter); the skill uses `disable-model-invocation: true` so it only runs when invoked explicitly.

### In Pi

```bash
/opsx-e2e <change-name>
```

Installed as `.pi/prompts/opsx-e2e.md` — a prompt template whose filename is the command name. Pi has no MCP client, so the workflow uses `openspec-pw explore` for browser exploration and `npx playwright test` for execution (no Healer).

### In Oh My Pi

```bash
/opsx-e2e <change-name>
```

Installed as `.omp/commands/opsx-e2e.md` (native omp command with `name` + `description` frontmatter). Playwright MCP is configured in `.omp/mcp.json`; omp also inherits MCP servers from `.claude/` / `.cursor/` / `opencode.json` when those are present.

### Selecting Editors on Init

`openspec-pw init` normally auto-detects the editors in your project and
configures all of them. To install only a subset (or none), use `--tools` —
matching the semantics of `openspec init --tools`:

```bash
openspec-pw init --tools claude,cursor   # only Claude Code and Cursor
openspec-pw init --tools all             # every supported editor
openspec-pw init --tools none            # no editors; scaffold only
```

Supported ids: `claude`, `opencode`, `cline`, `cursor`, `pi`, `omp`
(`oh-my-pi` is accepted as an alias for `omp`). Ids are case-insensitive,
repeats are de-duplicated, and `all`/`none` cannot be mixed with specific
ids. A `--tools` id is configured even when the editor is not detected
(its config directory is created).

Without `--tools`, an interactive multi-select is shown on TTY terminals.
The pre-select reads the **openspec-pw configuration manifest, not
directory presence**: editors that carry openspec-pw products (command
files, MCP entries, claude's legacy skill dir) are pre-checked and labeled
`(configured)`. A project with no openspec-pw state at all (first run)
pre-checks **project-level signals only** — marker dirs plus root
intent files (root `CLAUDE.md` → claude, root `.cursorrules` → cursor,
root `opencode.json(c)` → opencode). Editors installed on your machine but
not used by the project (e.g. Pi / Oh My Pi detected via the global
`~/.pi/agent/` / `~/.omp/agent/` home dirs) are **listed unchecked** with a
gray hint line. Once anything is configured, foreign files that keep an editor's directory
alive (the official `openspec` CLI's own `opsx-*` files, your own
settings, global home dirs) no longer influence the pre-select.
`--tools` is documented as orthogonal to `--no-mcp`: the former picks
*which* editors, the latter *whether* to install the Playwright MCP server
for them.

Init prints two output signals: the pre-select hint line (only when
`--tools` is not given) — `Configured (pre-select):` on projects with
openspec-pw state, `Detected (pre-select):` in the first-run fallback —
is **not** the install set; the `Selected editors:` line (always printed,
before any editor is configured) is the actual install set. When in
doubt, read `Selected editors`.

**Deselect = remove.** In the interactive multi-select, a *detected editor
you deselect* has its openspec-pw products removed — command/skill files,
the editor's openspec-pw MCP entries (claude's wrapper block and legacy
skill directory included, plus any tool-owned vendored agents), after one
confirmation listing everything about
to be removed. Declining keeps the old behavior (deselect merely skips
writes this run). Only openspec-pw-owned territory is touched — your own
config entries in the same files stay (user-modified vendored agent files
are kept and reported, never deleted). Shared rules: the AGENTS.md
openspec-pw block is removed only when **no** editor remains selected; a
symlinked CLAUDE.md is never written through. `--tools` and non-TTY runs
never remove anything (`--tools` is an explicit allow list). Removal
feeds straight back into the pre-select: a removed editor is no longer
pre-checked on the next init (the pre-select reads the openspec-pw
manifest, so directory residue — kept `mcp.json`, your own files, global
home dirs — no longer matters). A *fully* deselected and confirmed
project resets to the first-run pre-select on the next init.

**Editor territory**: `update` only maintains editors that already have
openspec-pw command artifacts in the project — it never adds new editors
(a global config dir or a hand-created `.cursor/` does not authorize
writes). To add an editor to an initialized project, re-run
`openspec-pw init --tools <id>` (idempotent).

### Official Playwright Agents (opt-in `--agents`)

```bash
openspec-pw init --tools claude --agents   # additionally install the official agent definitions
```

`--agents` (off by default) installs byte-identical snapshots of the three
agent definitions Playwright's official `playwright init-agents` (claude
loop) generates into `.claude/agents/`:

- `playwright-test-planner.md` — explore the app, produce a test plan
- `playwright-test-generator.md` — generate test code
- `playwright-test-healer.md` — debug and fix failing tests

Their `tools:` frontmatter references the `playwright-test` MCP server —
the very entry `openspec-pw init` installs — so the MCP prerequisite is
already satisfied. On the interactive path, init appends one confirmation
(default **No**); API-only projects skip the phase alongside the MCP
(phase follows the same frontend-signal gate, since the agents' tools are
MCP tools). Ownership is content-based: files matching the bundled
snapshot (`templates/agents/SOURCE.md` records the upstream baseline) are
tool-owned — `update` refreshes them when a newer snapshot ships and
removal paths delete them; files you edited (or refreshed with a newer
official `init-agents`) are **never overwritten or deleted**, only
reported. `doctor` shows their presence, ownership, and — when the
`playwright-test` MCP entry is missing — a non-blocking warning.

**Division of labor vs `/opsx:e2e`**: the command template is the
OpenSpec-anchored pipeline (plan → generate → heal with the App Bug
Registry → Phase 3 human escalation); the vendored agents are standalone
subagents for ad-hoc calls when no OpenSpec change is in flight. Inside the
workflow, the Planner and Generator steps may delegate to their subagents
when installed (the rules travel with the delegation prompt, and you verify
the output); the Healer step **never delegates** — the pipeline's guardrails
replace the official healer's autonomous assertion editing. The project's
AGENTS.md §6 binds agents from any source.

> **Official healer vs our guardrails**: the official healer is instructed
> not to ask the user and to fix failing tests by modifying assertions and
> expected values. This tool's Healer pipeline **never loosens assertions
> without approval** — updating an assertion or the spec is a Phase 3 human
> decision. Invoking the standalone official healer for a quick fix is your
> call; just don't mix its output into a `/opsx:e2e` delivery.

> **If you insist on running `npx playwright init-agents` yourself**: it is
> clobber-type — it rewrites `.mcp.json` wholesale (your own MCP entries are
> destroyed; fixture-verified), creates a parallel `opencode.json` next to
> an existing `opencode.jsonc`, and wants a re-run on every Playwright
> upgrade. Run it *before* `openspec-pw init` if you must, and check
> `git diff .mcp.json` afterward. With `--agents` you never need it —
> `update` ships newer official snapshots.
### CLI Commands

```bash
openspec-pw init          # Initialize integration (--tools all|none|ids… to select editors; --agents adds the official agents)
openspec-pw update        # Update CLI and commands to latest version
openspec-pw doctor        # Check prerequisites (Node, Playwright, OpenSpec, config, tests) + app server diagnostics
openspec-pw audit         # Audit tests for orphaned specs and issues
openspec-pw coverage      # Analyze spec–test coverage for changes
openspec-pw flake         # Detect static flake patterns in test files
openspec-pw migrate       # Migrate old test files to new structure
openspec-pw explore       # Explore app routes with Playwright
openspec-pw uninstall     # Remove integration from the project
```

## How It Works

### Spec anchors & stale-test audit

Every test the Generator writes carries a **spec anchor** — one comment line above each `test()`:

```typescript
// spec: coupon#优惠券七天后过期
test('coupon expires after 7 days', async ({ page }) => { ... });
```

The anchor's `<capability>#<requirement>` uses the requirement's **exact title text** from the delta spec (no slug conversion), so `openspec-pw audit` can check it against the live main spec with plain text matching. The audit reports four states:

| State | Signal | Meaning |
|---|---|---|
| Anchor's requirement gone from the main spec | ⚠ issue, cites the archived change that removed it | Test is a retire candidate — delete, `test.fixme` with reason, or keep if the behavior lives on |
| Anchor's capability directory missing | ⚠ issue (separate class) | Likely a capability rename — verify before retiring |
| Anchor-free tests in a change dir | ℹ one info line per directory | Pre-anchors legacy or missing anchors — visibility only, never an issue count |
| `test.fixme` tests | skipped | A declared "known-stale, kept on purpose" — reporting it would be noise |

Audit is **report-only** — it never deletes or edits tests; retiring a test is always a human decision. Existing anchor-free tests are not migrated; they age out as new tests carry anchors. Recorded (`generator_write_test`) output is step-cut and carries no anchors — the template's review checklist adds them.

```
/opsx:e2e <change-name>          # Claude Code
/opsx-e2e <change-name>          # OpenCode / Cline / Cursor / Pi / Oh My Pi
  │
  ├── 1. Select change → read openspec/changes/<name>/specs/
  │
  ├── 2. Detect auth → check specs for login/auth markers
  │
  ├── 3. Validate env → run seed.spec.ts
  │
  ├── 4. Explore app → browser exploration (Playwright MCP / `openspec-pw explore`)
  │       ├─ Read app-knowledge.md (project-level knowledge)
  │       ├─ Extract routes from specs
  │       ├─ Navigate each route → snapshot → screenshot
  │       └─ Write app-exploration.md (change-level findings)
  │           └─ Extract patterns → update app-knowledge.md
  │
  ├── 5. Planner → generates test-plan.md
  │
  ├── 6. Generator → creates tests/playwright/changes/<name>/<name>.spec.ts
  │       └─ Verifies selectors in real browser before writing
  │
  ├── 7. Configure auth → auth.setup.ts (if required)
  │
  ├── 8. Configure playwright → playwright.config.ts
  │
  ├── 9. Execute tests → npx playwright test
  │
  ├── 10. Healer (if needed) → auto-heals failures via MCP
  │
  └── 11. Report → openspec/reports/playwright-e2e-<name>-<timestamp>.md
```

## Prerequisites

**Required:**

1. **Node.js >= 20**
2. **Claude Code** (with `.claude/` directory) and/or **OpenCode** (with `.opencode/` directory) and/or **Cline** (with `.cline/` or `.clinerules/` directory) and/or **Cursor** (with `.cursor/` directory) and/or **Pi** (project `.pi/` or global `~/.pi/agent/`) and/or **Oh My Pi** (project `.omp/` or global `~/.omp/agent/`)
3. **OpenSpec** initialized: `npm install -g @fission-ai/openspec@latest && openspec init`
4. **Playwright MCP** (for test execution + Healer) — installed automatically by `openspec-pw init` when a frontend signal is detected (skipped for API-only projects — API tests use the `request` fixture), **project-scoped** (written to a project file; Claude Code uses `--scope project` → project-root `.mcp.json`, never your global `~/.claude.json`). A single server matching the official `playwright init-agents` layout:
   - `playwright-test` — official test-runner server (`npx playwright run-test-mcp-server`, bundled with the `playwright` package). Superset of `@playwright/mcp`: one entry exposes both `browser_*` tools (exploration + Healer page inspection) and the structured `test_run` / `test_debug` / `test_list` workflow tools for the Healer loop.
   - **Claude Code**: `claude mcp add --scope project playwright-test npx playwright run-test-mcp-server` (stored in project-root `.mcp.json`, usable by the whole team via version control)
   - **OpenCode**: merged into `opencode.jsonc` under `mcp["playwright-test"] = { type: "local", command: ["npx", "playwright", "run-test-mcp-server"] }`
   - **Cline**: merged into `.cline/mcp.json` under `mcpServers["playwright-test"] = { "command": "npx", "args": ["playwright", "run-test-mcp-server"] }`
   - **Cursor**: merged into `.cursor/mcp.json` under `mcpServers["playwright-test"] = { "command": "npx", "args": ["playwright", "run-test-mcp-server"] }`

> **Migrating from older versions**: before this change, Claude Code's Playwright MCP was installed at global user scope (`~/.claude.json`). If you initialized with an older `openspec-pw`, a stale global entry may still load everywhere. Clean it up once: `claude mcp remove playwright` (user scope). Note that project-scoped servers prompt for approval the first time they are used interactively (`claude mcp reset-project-choices` resets those choices).

> **Server name `playwright-test`**: this is the name Playwright's own `playwright init-agents` CLI ships — same name, same transport (`npx playwright run-test-mcp-server`, the `playwright` package's built-in subcommand). It is **not** the same server as `@playwright/mcp` (a separate npm package that registers as `playwright` with ~67 `browser_*` tools); the test-runner is its **superset** (~80 tools: the full `browser_*` set plus the structured `test_run` / `test_debug` / `test_list` workflow tools the Healer loop uses). The two servers coexist under different names; search results for "Playwright MCP" usually surface `@playwright/mcp` docs.

Browser exploration is provided out of the box by Playwright MCP and `openspec-pw explore`; no extra browser tool is needed.

## What `openspec-pw init` Does

1. Detects supported editors in the project (Claude Code and/or OpenCode and/or Cline and/or Cursor and/or Pi and/or Oh My Pi; Pi and Oh My Pi are also detected via their global config dirs `~/.pi/agent/` / `~/.omp/agent/`)
2. Installs the E2E command for each detected editor (`/opsx:e2e` for Claude Code, `/opsx-e2e` for OpenCode, Cline, Cursor, Pi, and Oh My Pi; Cursor also gets an Agent Skill)
3. Generates `tests/playwright/seed.spec.ts`, `auth.setup.ts`, `credentials.yaml`, `app-knowledge.md`, `pages/BasePage.ts`
4. Generates `playwright.config.ts` with automatic dev script and port detection (Vite/Next/Nuxt/Astro, `.env`, and `--port`)
5. Detects a frontend signal (layered detection: framework config files → framework dependencies → frontend dev commands, plus monorepo workspace member detection so a pnpm/npm workspace with the frontend in `apps/*` is recognized); with none found, prints guidance in the Summary — run `openspec-pw init` in the app directory (monorepo), or use Playwright's `request` fixture for API-only projects

> **Note**: After running `openspec-pw init`, manually install Playwright browsers: `npx playwright install --with-deps`

## First-Time Setup Checklist

Run through these steps in order when using the E2E workflow for the first time:

| Step | Command | If it fails |
|------|---------|-------------|
| 1. Install CLI | `npm install -g openspec-playwright@latest` | Check Node.js version `node -v` (needs >= 20) |
| 2. Install OpenSpec | `npm install -g @fission-ai/openspec@latest && openspec init` | `npm cache clean -f && npm install -g @fission-ai/openspec@latest` |
| 3. Initialize E2E | `openspec-pw init` | Run `openspec-pw doctor` to see what's missing |
| 4. Install Playwright MCP | `claude mcp add --scope project playwright-test npx playwright run-test-mcp-server` (Claude, writes project-root `.mcp.json`), or add `mcp["playwright-test"]` to `opencode.jsonc` (OpenCode), or `mcpServers["playwright-test"]` in `.cline/mcp.json` / `.cursor/mcp.json` | `cat .mcp.json` (Claude, check `mcpServers["playwright-test"]`) / `cat opencode.jsonc` (OpenCode) / `cat .cline/mcp.json` (Cline) / `cat .cursor/mcp.json` (Cursor) |
| 5. Install browsers | `npx playwright install --with-deps` | macOS may need `xcode-select --install` first |
| 6. Start dev server | `npm run dev` (in a separate terminal) | Confirm port, set `BASE_URL` if non-standard |
| 7. Validate env | `npx playwright test tests/playwright/seed.spec.ts` | Check `webServer` in `playwright.config.ts` |
| 8. Configure auth (if needed) | See "Authentication" below | Debug with `npx playwright test --project=setup` |
| 9. Run first E2E | `/opsx:e2e <change-name>` (Claude) or `/opsx-e2e <change-name>` (OpenCode / Cline / Cursor / Pi / Oh My Pi) | Check `openspec/reports/` for the report |

### What `openspec-pw doctor` checks

`openspec-pw doctor` verifies prerequisites across 10 categories and exits non-zero if any **required** check fails.

| Category | Required checks | Optional checks |
|---|---|---|
| **Node.js** | `node` version | `engines` compatibility (vs `package.json`) |
| **npm** | `npm` availability | — |
| **Playwright Config** | config file exists (`ts`/`js`/`mjs`/`mts`) | — |
| **OpenSpec** | directory initialized | `.spec.md` specs count |
| **Playwright Browsers** | CLI version, Chromium binary downloaded | — |
| **Playwright Test** | `@playwright/test` framework installed | — |
| **Playwright MCP** | test-runner server configured for each **authorized** editor (command artifacts exist; unauthorized editors get an info line pointing at `init --tools <id>` — never a warning) | `playwright-cli` (@playwright/cli on PATH) — optional ⚠, never block |
| **Vendored Agents** | — | official agent snapshots' presence + ownership (owned/modified); non-blocking ⚠ when their `playwright-test` MCP dependency is missing |
| **Sync** | standards in sync when initialized (drift → `openspec-pw update`; AGENTS.md without markers counts as not-initialized, always ok) | not initialized (gated, non-blocking) |
| **Tests** | `tests/playwright/` directory exists | `auth.setup.ts` presence |
| **Seed Test** | — | `seed.spec.ts` presence |
| **App Server** | — | dev script, base URL, reachability |
| **CodeGraph** | — | CLI availability, index presence, MCP installation (warnings, non-blocking) |

Run with `--json` for machine-readable output.

## App Server Detection

Generated `playwright.config.ts` automatically detects the app URL in this priority order:

1. `BASE_URL` environment variable
2. environment variables: `PLAYWRIGHT_PORT`, `E2E_PORT`, `VITE_PORT`, `PORT`
3. port flags in `package.json` scripts, e.g. `vite --port 5125`
4. `vite.config.*` `server.port`
5. `.env.local`, `.env.development`, `.env` (same env var names)
6. framework defaults: Vite `5173`, Astro `4321`, Next/Nuxt `3000`
7. `seed.spec.ts` `BASE_URL` constant
8. fallback: `http://localhost:3000`

Run `openspec-pw doctor` to see the detected dev script and base URL:

```text
─── App Server ───
  ✓ dev-script: npm run dev:all
  ✓ base-url: http://localhost:5125 (vite.config.ts)
  ⚠ reachable: fetch failed (diagnostic only; Playwright webServer may start it)
```

If your project already has `playwright.config.ts`, `openspec-pw init` will not overwrite it. It prints patch hints for missing `webServer`, `testDir`, `storageState`, and setup-project wiring.

## Authentication

If your app requires login, set up credentials once, then all tests run authenticated automatically.

> **Keep credentials out of git**: add `tests/playwright/credentials.yaml` (and the `credentials.yaml.bak` that `openspec-pw update` writes) to your `.gitignore`, or keep credentials in the `E2E_USERNAME` / `E2E_PASSWORD` env vars instead. init and update print a warning when these files are not ignored.

```bash
# 1. Edit credentials
vim tests/playwright/credentials.yaml

# 2. Enable auth and set environment variables
export E2E_AUTH_REQUIRED=true
export E2E_AUTH_METHOD=api # or ui
export E2E_USERNAME=your-email@example.com
export E2E_PASSWORD=your-password

# 3. Record login (one-time — opens browser, log in manually)
npx playwright test --project=setup

# 4. All subsequent tests use the saved session
/opsx:e2e my-feature
```

Supports **API login** (preferred) and **UI login** (fallback). For multi-user tests (admin vs user), add multiple users in `credentials.yaml` and run `/opsx:e2e` (or `/opsx-e2e` in OpenCode/Cline/Cursor/Pi/Oh My Pi) — it auto-detects roles from specs.

## Customization

### Customize seed test

Edit `tests/playwright/seed.spec.ts` to match your app's:
- Base URL
- Common selectors
- Page object methods

### Authentication credentials

Edit `tests/playwright/credentials.yaml`:
- Set login API endpoint (or leave empty for UI login)
- Configure test user credentials
- Add multiple users for role-based tests

## Architecture

```
Templates (in npm package, installed to tests/playwright/)
  └── seed.spec.ts, auth.setup.ts, credentials.yaml, app-knowledge.md, pages/BasePage.ts

CLI (openspec-pw)
  ├── init       → Installs commands & templates
  ├── update     → Syncs commands & templates from npm
  ├── migrate    → Migrates old test files to new structure
  ├── audit      → Audits tests for orphaned specs and issues
  ├── coverage   → Analyzes spec–test coverage for changes
  ├── flake      → Detects static flake patterns in test files
  ├── doctor     → Checks prerequisites
  ├── explore    → Explores app routes with Playwright
  └── uninstall  → Removes integration from the project

Editors (auto-detected by openspec-pw init)
  ├── Claude Code (/opsx:e2e)
  │   ├── .claude/commands/opsx/e2e.md   → Command file
  │   ├── playwright-test server         → Healer Agent tools (via `claude mcp add --scope project playwright-test …`, writes project-root `.mcp.json`)
  │   ├── .claude/agents/playwright-test-*.md → Official agent snapshots (opt-in `--agents`)
  │   └── CLAUDE.md                      → CodeGraph 优先 block + workflow hint + imports AGENTS.md via `@AGENTS.md`
  ├── OpenCode (/opsx-e2e)
  │   ├── .opencode/commands/opsx-e2e.md → Command file (body rewritten from /opsx: → /opsx-)
  │   ├── opencode.jsonc                 → Playwright MCP (mcp["playwright-test"]) + instructions routing
  │   └── AGENTS.md                      → Employee-grade standards (SSOT)
  ├── Cline (/opsx-e2e)
  │   ├── .cline/skills/opsx-e2e/SKILL.md → Skill file (body rewritten from /opsx: → /opsx-)
  │   ├── .cline/mcp.json                 → Playwright MCP (mcpServers["playwright-test"])
  │   └── AGENTS.md                       → Employee-grade standards (auto-detected by Cline)
  ├── Cursor (/opsx-e2e)
  │   ├── .cursor/commands/opsx-e2e.md    → Slash command (plain MD, $1 = change name)
  │   ├── .cursor/skills/opsx-e2e/SKILL.md → Skill (disable-model-invocation: true)
  │   ├── .cursor/mcp.json                → Playwright MCP (mcpServers["playwright-test"])
  │   └── AGENTS.md                       → Employee-grade standards (auto-detected by Cursor)
  ├── Pi (/opsx-e2e)
  │   ├── .pi/prompts/opsx-e2e.md         → Prompt template (filename = command name)
  │   └── AGENTS.md                       → Employee-grade standards (auto-detected by Pi)
  │       (no MCP client — exploration via `openspec-pw explore`)
  └── Oh My Pi (/opsx-e2e)
      ├── .omp/commands/opsx-e2e.md       → Command file (name + description frontmatter)
      ├── .omp/mcp.json                   → Playwright MCP (mcpServers["playwright-test"])
      └── AGENTS.md                       → Employee-grade standards (auto-detected by omp)

Employee-grade standards live in **AGENTS.md** as the single source of truth. Claude Code
loads them via a CLAUDE.md that carries a CodeGraph-first block and an OpenSpec-workflow
hint up front, followed by an `@AGENTS.md` import — Claude Code's documented mechanism for
reusing AGENTS.md, which it does not read by default. Import position is unconstrained
("anywhere in your CLAUDE.md"); the only rule is the `@` line must not sit inside backticks
or a code block. The import line sits outside the OPENSPEC-PW:START/END comments (stripped
before context injection), so the markers act as the tool-owned boundary while the import is
honored. OpenCode registers AGENTS.md in `opencode.jsonc` under `instructions`. Cline and
Cursor auto-detect `AGENTS.md` natively — no wrapper file needed.

> **Coexisting with the official `@fission-ai/openspec` CLI**: its `openspec update` runs a
> "legacy cleanup" that deletes any root AGENTS.md/CLAUDE.md block wrapped in plain
> `OPENSPEC:START/END` markers. openspec-pw blocks use the exclusive `OPENSPEC-PW:` namespace,
> which the official matcher cannot see (verified against v1.11.0). Projects installed before
> this change are migrated automatically on the next `openspec-pw update`/`init`; if the block
> was already wiped, `openspec-pw update` warns loudly and `openspec-pw init` restores it.

Test Assets (tests/playwright/)
  ├── seed.spec.ts         → Env validation
  ├── auth.setup.ts        → Session recording
  ├── global.teardown.ts   → Post-test cleanup (optional)
  ├── credentials.yaml     → Test users
  ├── app-knowledge.md     → Project-level selector patterns (cross-change)
  └── pages/BasePage.ts    → Shared page object class

Exploration (openspec/changes/<name>/specs/playwright/)
  ├── app-exploration.md → This change's routes + verified selectors
  └── test-plan.md       → This change's test cases

Healer Agent (playwright-test MCP server)
  └── browser_snapshot, browser_navigate, browser_run_code, etc.
```

## License

MIT
