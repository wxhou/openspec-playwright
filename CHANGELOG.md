# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.62] - 2026-04-02

### Added
- `openspec-pw uninstall` command to remove integration from a project
- `npm run typecheck` script (`tsc --noEmit`)
- `npm run test:smoke` script (build + smoke tests)
- `tests/smoke.test.ts` with 11 smoke tests covering dist output, module imports, and CLI behavior
- `npm run test:smoke` for build + smoke tests
- CI workflow (`.github/workflows/ci.yml`) for pull request checks
- `package.json` `"files"` field to reduce npm package size
- Vitest coverage configuration (v8 + lcov reporter)
- CHANGELOG.md
- GitHub Issue Templates (bug report + feature request)

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
