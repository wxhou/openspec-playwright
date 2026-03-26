# OpenSpec-Playwright

CLI tool integrating OpenSpec spec-driven workflow with Playwright Test Agents.

## Quick Start

```bash
npm install -g openspec-playwright
cd your-project
openspec-pw init
openspec-pw verify --change my-feature
```

## Key Files

- `src/commands/` - CLI commands (init, verify, plan, heal)
- `src/lib/openspec.ts` - OpenSpec artifact reading & native verify
- `src/lib/playwright-agent.ts` - Playwright Planner/Generator/Healer pipeline
- `src/lib/report.ts` - Combined report generation
