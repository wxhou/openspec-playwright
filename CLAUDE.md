# openspec-playwright

Setup tool for OpenSpec + Playwright E2E integration.

## Project Structure

- `src/commands/init.ts` — `openspec-pw init` setup logic
- `src/commands/doctor.ts` — `openspec-pw doctor` prerequisites checker
- `.claude/skills/openspec-e2e/SKILL.md` — Claude Code skill for `/opsx:e2e`
- `.claude/commands/opsx/e2e.md` — Claude Code command
- `templates/seed.spec.ts` — Playwright seed test template
- `templates/auth.setup.ts` — Authentication setup (API + UI login)
- `templates/credentials.yaml` — Test credentials configuration

## Key Files

- `package.json` — ESM module, Node >= 20
- `src/index.ts` — CLI entry with commander

## Build

```bash
npm run build
```

## Release Checklist

Before each `git tag vX.Y.Z && git push --tags`:

- [ ] `npm ci --dry-run` succeeds (verifies lockfile sync)
- [ ] `npm run typecheck` passes
- [ ] `npm run test:run` passes
- [ ] `npm run build && npm pack && tar tf openspec-playwright-*.tgz | grep .claude` succeeds (verifies package contents)
- [ ] `package.json` version already updated to `X.Y.Z`
- [ ] `git log --oneline` shows expected changes
- [ ] If re-tagging: delete old tag first — `git tag -d vX.Y.Z && git push origin :refs/tags/vX.Y.Z`

**Key rules:**
- CI workflow must NEVER modify git history (no amend, no force-push)
- Tests must not use hardcoded absolute paths — use `process.cwd()` or env vars
- Periodically regenerate lockfile: `rm -rf node_modules package-lock.json && npm install`
