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

### CLI Commands

```bash
openspec-pw init          # Initialize integration (one-time setup; add --seed to overwrite existing seed.spec.ts)
openspec-pw update        # Update CLI and commands to latest version
openspec-pw doctor        # Check prerequisites + app server diagnostics
openspec-pw audit         # Audit tests for orphaned specs and issues
openspec-pw coverage      # Analyze spec–test coverage for changes
openspec-pw flake         # Detect static flake patterns in test files
openspec-pw migrate       # Migrate old test files to new structure
openspec-pw explore       # Explore routes in parallel with Playwright
openspec-pw run <name>    # Execute E2E tests for a change
openspec-pw uninstall     # Remove integration from the project
```

## How It Works

```
# Triggered by /opsx:e2e <change-name> (Claude Code) or /opsx-e2e <change-name> (OpenCode)
/opsx:e2e <change-name>
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
  ├── 9. Execute tests → openspec-pw run <name>
  │
  ├── 10. Healer (if needed) → auto-heals failures via MCP
  │
  └── 11. Report → openspec/reports/playwright-e2e-<name>.md
```

## Prerequisites

**Required:**

1. **Node.js >= 20**
2. **Claude Code** (with `.claude/` directory) and/or **OpenCode** (with `.opencode/` directory)
3. **OpenSpec** initialized: `npm install -g @fission-ai/openspec@latest && openspec init`
4. **Playwright MCP** (for test execution + Healer) — installed automatically by `openspec-pw init` for the detected editor:
   - **Claude Code**: `claude mcp add playwright npx @playwright/mcp@latest`
   - **OpenCode**: merged into `opencode.jsonc` under `mcp.playwright = { type: "local", command: ["npx", "@playwright/mcp@latest"] }`

**Optional** — enhance your AI coding assistant with Superpowers methodology:

- **Superpowers**: a complete development methodology plugin for Claude Code. It enhances the OpenSpec workflow (propose → apply → verify) with conversational spec exploration, TDD discipline, and subagent-driven implementation. Superpowers does **not** replace OpenSpec — the E2E verification pipeline (`/opsx:e2e`, `openspec-pw doctor/explore/run`) remains unchanged.
  ```bash
  /plugin install superpowers@claude-plugins-official
  ```
  See [github.com/obra/superpowers](https://github.com/obra/superpowers) for details.

Browser exploration is provided out of the box by Playwright MCP and `openspec-pw explore`; no extra browser tool is needed.

## What `openspec-pw init` Does

1. Detects supported editors in the project (Claude Code and/or OpenCode)
2. Installs the E2E command for each detected editor (`/opsx:e2e` for Claude Code, `/opsx-e2e` for OpenCode)
3. Generates `tests/playwright/seed.spec.ts`, `auth.setup.ts`, `credentials.yaml`, `app-knowledge.md`
4. Generates `playwright.config.ts` with automatic dev script and port detection (Vite/Next/Nuxt/Astro, `.env`, and `--port`)

> **Note**: After running `openspec-pw init`, manually install Playwright browsers: `npx playwright install --with-deps`

## First-Time Setup Checklist

Run through these steps in order when using the E2E workflow for the first time:

| Step | Command | If it fails |
|------|---------|-------------|
| 1. Install CLI | `npm install -g openspec-playwright@latest` | Check Node.js version `node -v` (needs >= 20) |
| 2. Install OpenSpec | `npm install -g @fission-ai/openspec@latest && openspec init` | `npm cache clean -f && npm install -g @fission-ai/openspec@latest` |
| 3. Initialize E2E | `openspec-pw init` | Run `openspec-pw doctor` to see what's missing |
| 4. Install Playwright MCP | `claude mcp add playwright npx @playwright/mcp@latest` (Claude), or add `mcp.playwright` to `opencode.jsonc` (OpenCode) | `claude mcp list` (Claude) / `cat opencode.jsonc` (OpenCode) to confirm |
| 5. Install browsers | `npx playwright install --with-deps` | macOS may need `xcode-select --install` first |
| 6. Start dev server | `npm run dev` (in a separate terminal) | Confirm port, set `BASE_URL` if non-standard |
| 7. Validate env | `npx playwright test tests/playwright/seed.spec.ts` | Check `webServer` in `playwright.config.ts` |
| 8. Configure auth (if needed) | See "Authentication" below | Debug with `npx playwright test --project=setup` |
| 9. Run first E2E | `/opsx:e2e <change-name>` (Claude) or `/opsx-e2e <change-name>` (OpenCode) | Check `openspec/reports/` for the report |

**Optional — enhance your AI coding assistant with Superpowers methodology:**

| Step | Command | If it fails |
|------|---------|-------------|
| A. Install Superpowers | `/plugin install superpowers@claude-plugins-official` | See [github.com/obra/superpowers](https://github.com/obra/superpowers) for alternative install methods |

## App Server Detection

Generated `playwright.config.ts` automatically detects the app URL in this order:

1. `BASE_URL` environment variable
2. port flags in `package.json` scripts, e.g. `vite --port 5125`
3. `vite.config.*` `server.port`
4. `.env.local`, `.env.development`, `.env` (`PLAYWRIGHT_PORT`, `E2E_PORT`, `VITE_PORT`, `PORT`)
5. framework defaults: Vite `5173`, Astro `4321`, Next/Nuxt `3000`
6. fallback: `http://localhost:3000`

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

Supports **API login** (preferred) and **UI login** (fallback). For multi-user tests (admin vs user), add multiple users in `credentials.yaml` and run `/opsx:e2e` (or `/opsx-e2e` in OpenCode) — it auto-detects roles from specs.

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
  ├── run        → Executes E2E tests with server lifecycle
  ├── migrate    → Migrates old test files to new structure
  ├── audit      → Audits tests for orphaned specs and issues
  ├── flake      → Detects static flake patterns in test files
  ├── doctor     → Checks prerequisites
  ├── explore    → Explores routes in parallel with Playwright
  └── uninstall  → Removes integration from the project

Editors (auto-detected by openspec-pw init)
  ├── Claude Code (/opsx:e2e)
  │   ├── .claude/commands/opsx/e2e.md   → Command file
  │   ├── @playwright/mcp                → Healer Agent tools (via `claude mcp add playwright …`)
  │   └── CLAUDE.md                      → Employee-grade standards
  └── OpenCode (/opsx-e2e)
      ├── .opencode/commands/opsx-e2e.md → Command file (body rewritten from /opsx: → /opsx-)
      ├── opencode.jsonc                 → Playwright MCP (mcp.playwright) + instructions routing
      └── CLAUDE.md or AGENTS.md         → Employee-grade standards (routed by detected editors)

Test Assets (tests/playwright/)
  ├── seed.spec.ts         → Env validation
  ├── auth.setup.ts        → Session recording
  ├── global.teardown.ts   → Post-test cleanup (optional)
  ├── credentials.yaml     → Test users
  └── app-knowledge.md     → Project-level selector patterns (cross-change)

Exploration (openspec/changes/<name>/specs/playwright/)
  ├── app-exploration.md → This change's routes + verified selectors
  └── test-plan.md       → This change's test cases

Healer Agent (@playwright/mcp)
  └── browser_snapshot, browser_navigate, browser_run_code, etc.
```

## License

MIT
