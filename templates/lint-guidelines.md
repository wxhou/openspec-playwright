# Lint Guidelines — Swallowed Errors & Docstrings

<!-- openspec-pw: lint-guidelines 3e7aa4da -->

Machine reference for two employee-standards clauses (§1 捕获/吞错: "a caught exception must never vanish silently — the failure must be visible, any one exit"; §1 注释纪律: 公共接口的文档注释), plus the swallow mechanics that the §1 捕获/吞错 clause delegates here. Maintained by openspec-pw; refresh with `npx openspec-pw update`.

## Swallowed errors

| Rule | Tool | Fires on | Default | Boundary |
| --- | --- | --- | --- | --- |
| `no-empty` | ESLint (`@eslint/js` recommended) | empty catch block with no comment | enabled within recommended configs | blocks containing a comment are exempt — the exception survives, and human review resolves it |
| `E722` | ruff | bare `except:` | on by default | bare handlers only — typed/narrow catches are not flagged |
| `S110` | ruff | `except Exception: pass` | on by default | broad or bare handlers only |
| `S112` | ruff | `except Exception: continue` | on by default | broad or bare handlers only |
| `BLE001` | ruff | blind `except Exception` / `BaseException` | on by default | re-raised exceptions and handlers logging with `exc_info` enabled are exempt |
| `B904` | ruff | `raise` inside an except handler without `from` (dropped causality) | **off by default** — opt in | rethrown as-is (`raise ... from err` / `from None`) is the fix; bare re-`raise` is exempt |
| `W0702` | pylint | bare-except | on by default | see note |
| `W0718` | pylint | broad-exception-caught | on by default | see note |
| `W0707` | pylint | raise-missing-from (dropped causality) | on by default | see note |

## Docstrings

| Rule | Tool | Fires on | Default | Boundary |
| --- | --- | --- | --- | --- |
| `D100` | ruff (pydocstyle) | public module without a docstring | **off by default** — opt in | see note |
| `D101` | ruff (pydocstyle) | public class without a docstring | **off by default** | see note |
| `D102` | ruff (pydocstyle) | public method without a docstring | **off by default** — opt in | see note |
| `D103` | ruff (pydocstyle) | public function without a docstring | **off by default** | see note |
| `jsdoc/require-jsdoc` | ESLint (`eslint-plugin-jsdoc`) | function declaration without a JSDoc block | **off in ESLint core** — the plugin's recommended config enables it as a warning | default `require` checks `FunctionDeclaration` only; classes, methods and arrow functions are opt-in; use `publicOnly` to scope to exports and `contexts` for custom contexts; content rules (`jsdoc/require-param` etc.) are separate rules |
| `C0114` | pylint | missing-module-docstring | on by default | see note |
| `C0115` | pylint | missing-class-docstring | on by default | see note |
| `C0116` | pylint | missing-function-docstring | on by default | see note |

Note: pylint rules are on by default; only project config disables them. The four pydocstyle rules check presence only; D102/D103 exempt underscore-prefixed names.

## Enabling what is missing

Off-by-default rules above: **`B904`** (dropped-causality on `raise ... from` inside a handler), the docstring family (`D100`/`D101`/`D102`/`D103`), and `jsdoc/require-jsdoc` (off in ESLint core; the plugin's recommended config enables it as a warning).

In `pyproject.toml`:

```toml
[tool.ruff.lint]
extend-select = ["B904", "D100", "D101", "D102", "D103"]
```

In a dedicated `ruff.toml` / `.ruff.toml` (the `tool.ruff` prefix is dropped):

```toml
[lint]
extend-select = ["B904", "D100", "D101", "D102", "D103"]
```

(`select = ["B"]` or `["ALL"]` covers it too, and `extend-select = ["D"]` covers the docstring family — but the whole pydocstyle category also pulls in the mutually exclusive convention pairs (D203 vs D211, D212 vs D213), so naming the four ids is the quieter opt-in. The ruff swallow family — `E722`, `S110`, `S112`, `BLE001` — is already on by default; the pylint trio is on by default when pylint runs, and so are the pylint docstring checks `C0114`–`C0116`.)

For TS/JS, `no-empty` ships inside `@eslint/js`'s `recommended` config — a flat config that extends it already covers the shape. The JSDoc rules need the plugin installed and registered:

```js
import jsdoc from "eslint-plugin-jsdoc";

export default [
  { plugins: { jsdoc }, rules: { "jsdoc/require-jsdoc": "error" } },
];
```

## Swallow mechanics delegated by the §1 clause

The employee-standards clause keeps the policy (default propagate, the two legal exits). These mechanics live here; a human reviewer checks them, not a lint rule.

- **Promises**: an unawaited or uncaught promise counts as swallowing. Attach a handler or let the error propagate.
- **Cause chain**: a new error without a cause (`raise … from e` / `{cause: e}` / `%w`) loses the chain; logging then rethrowing unchanged is double handling, so log only at the exit.
- **Degrade and continue**: limited to a narrow catch (log debug/warning + an inline reason). The failed result must not be consumed downstream, and no inconsistent state may remain; otherwise propagate.
- **Untyped catch**: branch on error class (`instanceof` / error code). If the classes can't be enumerated, rethrow rather than guess a class or code.
- **Try scope**: a try block contains only the line that can fail (a bigger block swallows unrelated exceptions); cleanup goes in `finally` / `defer`.
- Inline reasons required by these rules are exempt from the comment-discipline blacklist.

## Boundary of this checklist

- These rules cover literal shapes only. The policy (default propagate, the two legal exits) is judged by the clause text. The delegated mechanics above are judged by human review, not by lint.
- A commented-out empty catch is exempt from ESLint `no-empty` — the comment does not make the failure visible. Human review carries it.
- The JS `.catch(() => null / false / undefined / {})` black-hole family and the Go `_ = err` discard have no built-in rule yet.
- Docstring rules check presence and shape only; the contract the docstring must carry (units, return semantics, raised errors, side effects, preconditions) is judged by the clause, not by lint.
- Hooks (agent-internal interceptors) are deliberately not part of this checklist — execution is lint config, CI, and pre-commit, none of which depend on the agent.