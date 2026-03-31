# OpenSpec + Playwright E2E Verification

[中文说明](./README.zh-CN.md)

A setup tool that integrates OpenSpec's spec-driven development with Playwright's three-agent test pipeline for automated E2E verification.

## Install

```bash
npm install -g openspec-playwright
```

## Setup

```bash
# In your project directory
openspec init              # Initialize OpenSpec
openspec-pw init          # Install Playwright E2E integration
```

## Supported AI Coding Assistants

Auto-detects and installs commands for these editors:

| Editor | Command | Format |
|--------|---------|--------|
| Claude Code | `/opsx:e2e` | Skill + command + MCP |
| Cursor | `/opsx-e2e` | Command |
| Windsurf | `/opsx-e2e` | Workflow |
| Cline | `/opsx-e2e` | Workflow |
| Continue | `/opsx-e2e` | Prompt |

`openspec-pw init` detects which editors you have in your project and installs the appropriate files. Claude Code gets the full experience (skill + command + Playwright MCP). Other editors get command/workflow files with the complete E2E workflow.

## Usage

### In Your AI Coding Assistant

```bash
/opsx:e2e my-feature    # Claude Code
/opsx-e2e my-feature   # Cursor, Windsurf, Cline, Continue
```

### CLI Commands

```bash
openspec-pw init          # Initialize integration (one-time setup)
openspec-pw update        # Update CLI and commands to latest version
openspec-pw doctor        # Check prerequisites
```

## How It Works

```
/openspec-e2e <change-name>
  │
  ├── 1. Read OpenSpec specs from openspec/changes/<name>/specs/
  │
  ├── 2. Planner Agent → generates test-plan.md
  │
  ├── 3. Generator Agent → creates tests/playwright/<name>.spec.ts
  │
  └── 4. Healer Agent → runs tests + auto-heals failures
          │
          └── Report: openspec/reports/playwright-e2e-<name>.md
```

### Two Verification Layers

| Layer | Command | What it checks |
|-------|---------|----------------|
| Static | `/opsx:verify` | Implementation matches artifacts |
| E2E | `/opsx:e2e` | App works when running |

## Prerequisites

1. **Node.js >= 20**
2. **OpenSpec** initialized: `npm install -g @fission-ai/openspec && openspec init`
3. **One of**: Claude Code, Cursor, Windsurf, Cline, or Continue (auto-detected)
4. **Claude Code only**: Playwright MCP — `claude mcp add playwright npx @playwright/mcp@latest`

## What `openspec-pw init` Does

1. Detects installed AI coding assistants (Claude Code, Cursor, Windsurf, Cline, Continue)
2. Installs E2E command/workflow files for each detected editor
3. Installs `/openspec-e2e` skill for Claude Code
4. Installs Playwright MCP globally for Claude Code (via `claude mcp add`)
5. Generates `tests/playwright/seed.spec.ts`, `auth.setup.ts`, `credentials.yaml`

> **Note**: After running `openspec-pw init`, manually install Playwright browsers: `npx playwright install --with-deps`

## Authentication

If your app requires login, set up credentials once, then all tests run authenticated automatically.

```bash
# 1. Edit credentials
vim tests/playwright/credentials.yaml

# 2. Set environment variables
export E2E_USERNAME=your-email@example.com
export E2E_PASSWORD=your-password

# 3. Record login (one-time — opens browser, log in manually)
npx playwright test --project=setup

# 4. All subsequent tests use the saved session
/opsx:e2e my-feature
```

Supports **API login** (preferred) and **UI login** (fallback). For multi-user tests (admin vs user), add multiple users in `credentials.yaml` and run `/opsx:e2e` — it auto-detects roles from specs.

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

### MCP server (Claude Code only)

Playwright MCP is installed globally via `claude mcp add` and enables the Healer Agent (auto-heals test failures via UI inspection). Restart Claude Code after setup to activate.

## Architecture

```
Schema (openspec/schemas/playwright-e2e/)
  └── Templates: test-plan.md, report.md, playwright.config.ts

CLI (openspec-pw)
  ├── init       → Installs commands for detected editors
  ├── update     → Syncs commands + schema from npm
  └── doctor     → Checks prerequisites

Skill/Commands (per editor)
  ├── Claude Code → /openspec-e2e (skill) + /opsx:e2e (command) + MCP
  ├── Cursor      → /opsx-e2e (command)
  ├── Windsurf    → /opsx-e2e (workflow)
  ├── Cline       → /opsx-e2e (workflow)
  └── Continue    → /opsx-e2e (prompt)

Healer Agent (Claude Code + MCP only)
  └── browser_snapshot, browser_navigate, browser_run_code, etc.
```

## License

MIT
