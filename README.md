# OpenSpec + Playwright E2E Verification

[中文说明](./README.zh-CN.md)

A setup tool that integrates OpenSpec's spec-driven development with Playwright's three-agent test pipeline for automated E2E verification.

## Install

```bash
npm install -g openspec-playwright@latest
```

## Setup

```bash
# In your project directory
openspec init              # Initialize OpenSpec
openspec-pw init          # Install Playwright E2E integration
```

## Supported AI Coding Assistants

**Claude Code** (Anthropic) — E2E workflow is driven by the `/opsx:e2e` command using a browser exploration tool (Playwright MCP or `openspec-pw explore`) + Playwright MCP (test execution).

**OpenCode** (SST) — E2E workflow is driven by the `/opsx-e2e` command (hyphenated per OpenSpec convention) using the same browser exploration + Playwright MCP stack. Playwright MCP is configured under `mcp.playwright` in `opencode.jsonc`.

**Cline** — E2E workflow is driven by the `/opsx-e2e` skill (installed as `.cline/skills/opsx-e2e/SKILL.md`) using the same browser exploration + Playwright MCP stack. Playwright MCP is configured in `.cline/mcp.json` under `mcpServers.playwright`. Cline auto-detects `AGENTS.md` as project rules — no wrapper file needed.

**Cursor** — E2E workflow is dual-installed: slash command at `.cursor/commands/opsx-e2e.md` (plain markdown, `$1` = change name) and Agent Skill at `.cursor/skills/opsx-e2e/SKILL.md` (`disable-model-invocation: true`). Invoke `/opsx-e2e`. Playwright MCP is merged into `.cursor/mcp.json` under `mcpServers.playwright`. Cursor auto-detects `AGENTS.md`. Skill name is `opsx-e2e` (not OpenSpec's `openspec-*` skill prefix). If you want Cursor support but have no `.cursor/` yet: `mkdir -p .cursor`.

**Pi** (earendil-works) — E2E workflow is driven by the `/opsx-e2e` prompt template (installed as `.pi/prompts/opsx-e2e.md`; the filename becomes the command name). Pi has **no MCP client**, so browser exploration runs through `openspec-pw explore` and test execution through `npx playwright test` in the shell. Pi loads `AGENTS.md` natively — no wrapper file needed. Detected via a project `.pi/` dir or the global `~/.pi/agent/` config dir.

**Oh My Pi (omp)** — E2E workflow is driven by the `/opsx-e2e` command (installed as `.omp/commands/opsx-e2e.md`). Playwright MCP is configured in `.omp/mcp.json` under `mcpServers.playwright` (omp also inherits `.claude/`/`.cursor/`/opencode MCP configs when present). omp auto-detects `AGENTS.md` — no wrapper file needed. Detected via a project `.omp/` dir or the global `~/.omp/agent/` config dir.

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
### CLI Commands

```bash
openspec-pw init          # Initialize integration (one-time setup)
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
4. **Playwright MCP** (for test execution + Healer) — installed automatically by `openspec-pw init` for the detected editor:
   - **Claude Code**: `claude mcp add playwright npx @playwright/mcp@latest`
   - **OpenCode**: merged into `opencode.jsonc` under `mcp.playwright = { type: "local", command: ["npx", "@playwright/mcp@latest"] }`
   - **Cline**: merged into `.cline/mcp.json` under `mcpServers.playwright = { "command": "npx", "args": ["@playwright/mcp@latest"] }`
   - **Cursor**: merged into `.cursor/mcp.json` under `mcpServers.playwright = { "command": "npx", "args": ["@playwright/mcp@latest"] }`

Browser exploration is provided out of the box by Playwright MCP and `openspec-pw explore`; no extra browser tool is needed.

## What `openspec-pw init` Does

1. Detects supported editors in the project (Claude Code and/or OpenCode and/or Cline and/or Cursor and/or Pi and/or Oh My Pi; Pi and Oh My Pi are also detected via their global config dirs `~/.pi/agent/` / `~/.omp/agent/`)
2. Installs the E2E command for each detected editor (`/opsx:e2e` for Claude Code, `/opsx-e2e` for OpenCode, Cline, Cursor, Pi, and Oh My Pi; Cursor also gets an Agent Skill)
3. Generates `tests/playwright/seed.spec.ts`, `auth.setup.ts`, `credentials.yaml`, `app-knowledge.md`, `pages/BasePage.ts`
4. Generates `playwright.config.ts` with automatic dev script and port detection (Vite/Next/Nuxt/Astro, `.env`, and `--port`)

> **Note**: After running `openspec-pw init`, manually install Playwright browsers: `npx playwright install --with-deps`

## First-Time Setup Checklist

Run through these steps in order when using the E2E workflow for the first time:

| Step | Command | If it fails |
|------|---------|-------------|
| 1. Install CLI | `npm install -g openspec-playwright@latest` | Check Node.js version `node -v` (needs >= 20) |
| 2. Install OpenSpec | `npm install -g @fission-ai/openspec@latest && openspec init` | `npm cache clean -f && npm install -g @fission-ai/openspec@latest` |
| 3. Initialize E2E | `openspec-pw init` | Run `openspec-pw doctor` to see what's missing |
| 4. Install Playwright MCP | `claude mcp add playwright npx @playwright/mcp@latest` (Claude), or add `mcp.playwright` to `opencode.jsonc` (OpenCode), or `mcpServers.playwright` in `.cline/mcp.json` / `.cursor/mcp.json` | `claude mcp list` (Claude) / `cat opencode.jsonc` (OpenCode) / `cat .cline/mcp.json` (Cline) / `cat .cursor/mcp.json` (Cursor) |
| 5. Install browsers | `npx playwright install --with-deps` | macOS may need `xcode-select --install` first |
| 6. Start dev server | `npm run dev` (in a separate terminal) | Confirm port, set `BASE_URL` if non-standard |
| 7. Validate env | `npx playwright test tests/playwright/seed.spec.ts` | Check `webServer` in `playwright.config.ts` |
| 8. Configure auth (if needed) | See "Authentication" below | Debug with `npx playwright test --project=setup` |
| 9. Run first E2E | `/opsx:e2e <change-name>` (Claude) or `/opsx-e2e <change-name>` (OpenCode / Cline / Cursor) | Check `openspec/reports/` for the report |

### What `openspec-pw doctor` checks

`openspec-pw doctor` verifies prerequisites across 9 categories and exits non-zero if any **required** check fails.

| Category | Required checks | Optional checks |
|---|---|---|
| **Node.js** | `node` version | `engines` compatibility (vs `package.json`) |
| **npm** | `npm` availability | — |
| **Playwright Config** | config file exists (`ts`/`js`/`mjs`/`mts`) | — |
| **OpenSpec** | directory initialized | `.spec.md` specs count |
| **Playwright Browsers** | CLI version, Chromium binary downloaded | — |
| **Playwright Test** | `@playwright/test` framework installed | — |
| **Playwright MCP** | configured for each detected editor (skipped with an informational note for Pi, which has no MCP client) | — |
| **Sync** | standards in sync when initialized (drift → `openspec-pw update`) | not initialized (gated, non-blocking) |
| **Tests** | `tests/playwright/` directory exists | `auth.setup.ts` presence |
| **Seed Test** | — | `seed.spec.ts` presence |
| **App Server** | — | dev script, base URL, reachability |

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

Supports **API login** (preferred) and **UI login** (fallback). For multi-user tests (admin vs user), add multiple users in `credentials.yaml` and run `/opsx:e2e` (or `/opsx-e2e` in OpenCode/Cline/Cursor) — it auto-detects roles from specs.

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
  │   ├── @playwright/mcp                → Healer Agent tools (via `claude mcp add playwright …`)
  │   └── CLAUDE.md                      → CodeGraph 优先 block + imports AGENTS.md via `@AGENTS.md`
  ├── OpenCode (/opsx-e2e)
  │   ├── .opencode/commands/opsx-e2e.md → Command file (body rewritten from /opsx: → /opsx-)
  │   ├── opencode.jsonc                 → Playwright MCP (mcp.playwright) + instructions routing
  │   └── AGENTS.md                      → Employee-grade standards (SSOT)
  ├── Cline (/opsx-e2e)
  │   ├── .cline/skills/opsx-e2e/SKILL.md → Skill file (body rewritten from /opsx: → /opsx-)
  │   ├── .cline/mcp.json                 → Playwright MCP (mcpServers.playwright)
  │   └── AGENTS.md                       → Employee-grade standards (auto-detected by Cline)
  ├── Cursor (/opsx-e2e)
  │   ├── .cursor/commands/opsx-e2e.md    → Slash command (plain MD, $1 = change name)
  │   ├── .cursor/skills/opsx-e2e/SKILL.md → Skill (disable-model-invocation: true)
  │   ├── .cursor/mcp.json                → Playwright MCP (mcpServers.playwright)
  │   └── AGENTS.md                       → Employee-grade standards (auto-detected by Cursor)
  ├── Pi (/opsx-e2e)
  │   ├── .pi/prompts/opsx-e2e.md         → Prompt template (filename = command name)
  │   └── AGENTS.md                       → Employee-grade standards (auto-detected by Pi)
  │       (no MCP client — exploration via `openspec-pw explore`)
  └── Oh My Pi (/opsx-e2e)
      ├── .omp/commands/opsx-e2e.md       → Command file (name + description frontmatter)
      ├── .omp/mcp.json                   → Playwright MCP (mcpServers.playwright)
      └── AGENTS.md                       → Employee-grade standards (auto-detected by omp)

Employee-grade standards live in **AGENTS.md** as the single source of truth. Claude Code
loads them via a CLAUDE.md that carries a CodeGraph-first block up front, followed by an
`@AGENTS.md` import — Claude Code's documented mechanism for reusing AGENTS.md, which it does
not read by default. Import position is unconstrained ("anywhere in your CLAUDE.md"); the only
rule is the `@` line must not sit inside backticks or a code block. The import line sits outside
the OPENSPEC:START/END comments (stripped before context injection), so the markers act as the
tool-owned boundary while the import is honored. OpenCode registers AGENTS.md in
`opencode.jsonc` under `instructions`. Cline and Cursor auto-detect `AGENTS.md` natively — no wrapper
file needed.

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

Healer Agent (@playwright/mcp)
  └── browser_snapshot, browser_navigate, browser_run_code, etc.
```

## License

MIT
