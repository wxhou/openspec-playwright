# OpenSpec + Playwright Test Agents

OpenSpec + Playwright Test Agents integration for automated E2E verification.

## Overview

This CLI tool integrates OpenSpec's spec-driven development workflow with Playwright's three-agent harness (Planner / Generator / Healer) for automated E2E verification.

When `/opsx:verify` runs, OpenSpec artifacts (`specs/`) are automatically fed into the Playwright Test Agents pipeline for end-to-end validation.

## Architecture

```
/opsx:verify
  │
  ├── OpenSpec Native Verify (static)
  │     Check: implementation matches artifacts?
  │
  └── Playwright E2E Verify (dynamic)
        │
        ├── Agent 1: Planner → test-plan.md (from specs/)
        ├── Agent 2: Generator → *.spec.ts
        └── Agent 3: Healer → run tests + auto-heal
```

## Install

```bash
npm install -g openspec-playwright
```

Or use directly with npx:

```bash
npx openspec-playwright verify --change my-feature
```

## Setup

```bash
# In your project directory
openspec init        # Initialize OpenSpec (if not done)
openspec-pw init     # Initialize Playwright + inject config context
```

## Usage

### Full Verify

```bash
openspec-pw verify --change <name>
```

Runs both OpenSpec native verify and Playwright E2E verify.

### Individual Commands

```bash
openspec-pw plan --change <name>   # Planner only
openspec-pw heal --change <name>   # Healer only
```

### Options

- `--change <name>` - Change name to verify (default: "default")
- `--skip-native` - Skip OpenSpec native verify
- `--skip-playwright` - Skip Playwright E2E verify

## How It Works

1. **Planner**: Reads OpenSpec `specs/*.md` files as PRD, generates `specs/playwright/test-plan.md`
2. **Generator**: Converts test plan to `tests/playwright/*.spec.ts`
3. **Healer**: Executes tests, auto-heals failures, reports results

## Claude Code Integration

After running `openspec-pw init`, the Playwright instructions are injected into `openspec/config.yaml`. When `/opsx:verify` runs in Claude Code, the config context guides the Playwright verification automatically.

## License

MIT
