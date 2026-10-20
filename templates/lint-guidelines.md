# Lint Guidelines — Swallowed Errors

<!-- openspec-pw: lint-guidelines 6957d228 -->

Machine reference for the swallow-error clause of the employee standards (§1: "a caught exception must never vanish silently — the failure must be visible, any one exit"). Maintained by openspec-pw; refresh with `npx openspec-pw update`.

Measures verified against: ruff 0.17.1 rule metadata (2026-10), pylint upstream `checkers/exceptions.py`, ESLint rule documentation.

## Rules

| Rule | Tool | Fires on | Default | Boundary |
| --- | --- | --- | --- | --- |
| `no-empty` | ESLint (`@eslint/js` recommended) | empty catch block with no comment | enabled within recommended configs | blocks containing a comment are exempt — the exception survives, and human review resolves it |
| `E722` | ruff | bare `except:` | on by default | typed handlers only — narrow catches are not flagged |
| `S110` | ruff | `except Exception: pass` | on by default | broad or bare handlers only |
| `S112` | ruff | `except Exception: continue` | on by default | broad or bare handlers only |
| `BLE001` | ruff | blind `except Exception` / `BaseException` | on by default | not flagged when the handler logs with `exc_info` enabled |
| `B904` | ruff | `raise` inside an except handler without `from` (dropped causality) | **off by default** — opt in | rethrown as-is (`raise ... from err` / `from None`) is the fix; bare re-`raise` is exempt |
| `W0702` | pylint | bare-except | on by default | pylint's default set; disabled only by project config |
| `W0718` | pylint | broad-exception-caught | on by default | pylint's default set; disabled only by project config |
| `W0707` | pylint | raise-missing-from (dropped causality) | on by default | pylint's default set; disabled only by project config |

## Enabling what is missing

The only off-by-default rule above is **`B904`** (dropped-causality on `raise ... from` inside a handler).

In `pyproject.toml`:

```toml
[tool.ruff.lint]
extend-select = ["B904"]
```

In a dedicated `ruff.toml` / `.ruff.toml` (the `tool.ruff` prefix is dropped):

```toml
[lint]
extend-select = ["B904"]
```

(`select = ["B"]` or `["ALL"]` covers it too. The ruff swallow family — `E722`, `S110`, `S112`, `BLE001` — is already on by default; the pylint trio is on by default when pylint runs.)

For TS/JS, `no-empty` ships inside `@eslint/js`'s `recommended` config — a flat config that extends it already covers the shape.

## Boundary of this checklist

- These rules cover literal shapes only. The clause's semantic exits (rethrow with cause, log-then-continue at a narrow catch, isolated catch-all at an isolating boundary) are judged by the clause text, not lint.
- A commented-out empty catch is exempt from ESLint `no-empty` — the comment does not make the failure visible. Human review carries it.
- The JS `.catch(() => null / false / undefined)` black-hole family has no built-in rule yet (a custom rule is a future batch).
- Hooks (agent-internal interceptors) are deliberately not part of this checklist — execution is lint config, CI, and pre-commit, none of which depend on the agent.