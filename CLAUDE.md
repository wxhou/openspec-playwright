# openspec-playwright

Setup tool for OpenSpec + Playwright E2E integration.

## Project Structure

- `src/commands/init.ts` — `openspec-pw init` setup logic
- `src/commands/doctor.ts` — `openspec-pw doctor` prerequisites checker
- `.claude/skills/openspec-e2e/SKILL.md` — Claude Code skill for `/opsx:e2e`
- `.claude/commands/opsx/e2e.md` — Claude Code command
- `templates/seed.spec.ts` — Playwright seed test template

## Key Files

- `package.json` — ESM module, Node >= 20
- `src/index.ts` — CLI entry with commander

## Build

```bash
npm run build
```
