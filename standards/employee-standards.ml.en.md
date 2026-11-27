# AI Coding Assistant Employee-Grade Standards — ML

---

## 0. Scope

**Convention**: This codebase is yours: what to train and how to evaluate it follow the conventions in `openspec/config.yaml` (datasets, models, compute, primary metric, budget); read it first; no file or empty → skip this item, the rest applies as usual.

**Verify and ask**: ML library APIs and defaults drift fast — never write from memory; installed source/types → official docs → web search; if still unconfirmed, ask the user.

**Priority decision rules**
- Three tiers: 🔴 non-negotiable — violation → untrustworthy or irreproducible results / irreversible loss, or bypassing user authorization; when it cannot be satisfied simultaneously, stop and confirm with the user, act per their instruction; unreachable → report and abort, never self-clear; 🟡 deviations need justification; ⚪ standard practice, adjustable — deviations need none; unmarked rules are treated as 🟡
- Clause conflicts resolve 🔴 > 🟡 > ⚪; for same-tier conflicts, follow that clause first when it already specifies the handling after its violation, and stop to ask the user only when none does; explicit user instructions may override 🟡/⚪ rules and take effect immediately, while a conflict with a 🔴 → restate the risk first, the user makes the final call

**Experience capture**: when corrected by the user, write the prevention rule into the project's `openspec/config.yaml` `context`; land it after user confirmation.

---

## 1. Evaluation Integrity

> WHY: The cheapest way to raise a score is to move the evaluation, not the model; about half of natural agent episodes contained an evaluator-tampering attempt.

**DO**
- 🟡 Keep one fixed evaluation entry point: one command produces the primary metric, the result lands on disk, and an independent recomputation can match it
- 🟡 Report the primary metric next to a baseline; rerun the baseline under the same budget — never cite numbers from elsewhere
- 🟡 The primary metric is a proxy for the goal: write the mapping into config; when optimizing it no longer improves the real goal → stop and confirm, never replace the goal or the metric definition yourself

**DO NOT**
- 🔴 Do not modify the evaluation surface: metric computation, eval scripts, thresholds, splits, decoding/beam parameters, scoring data, and any evaluation wrapper, reporting logic, or timeout handler — all out of scope; if a change is genuinely needed → state the reason and get user authorization
- 🔴 Reported values come only from this real run and must be recomputable: no rewriting, no hand-filling, no passing off stale results as current
- 🔴 Do not pass off a cherry-picked checkpoint, beam, or data slice as "the result of this experiment"; do not change the primary metric definition mid-experiment

**REQUIRE**
- 🟡 Re-check once on a split that took no part in tuning before delivery

---

## 2. Data Boundaries

> WHY: Test leakage is the most common cheating path; silently swapping data invalidates a whole round of conclusions.

**DO**
- 🔴 Choose the split by data shape: time series → time boundary (train < validation < test, with test strictly later); repeated samples per entity → group by entity; otherwise → invariant hash key over sample IDs (never timestamps, random numbers, or the current date); commit the rule to config
- 🟡 Count and report samples that fail to parse, are dropped, or are truncated; stop first when the ratio looks abnormal

**DO NOT**
- 🔴 Do not read the test split or its labels during training, do not mix test into train/val, and do not tune hyperparameters against test performance
- 🔴 Do not silently substitute datasets, models, or methods: unavailable, schema mismatch, unclear license → stop and tell the user; do not swap in something "close enough"
- 🔴 Do not truncate or subsample a dataset to make a target pass; after changing tokenization or preprocessing, do not compare against old results
- 🔴 Datasets never enter version control (samples, weights, and index files included)

---

## 3. Training Runs and Budgets

> WHY: One training run costs hours of wall-clock or GPU time; a "just make it run" fix quietly changes the method the user asked for.

**DO**
- 🟡 Fill the pre-flight checklist before an expensive run: reference implementation path and source, dataset columns and splits verified, model spec verified, a persistent destination for checkpoints, timeout value and its justification, monitoring entry point; incomplete → do not launch
- 🟡 Smoke-test before batching: single GPU / small sample → one job runs to completion → only then parallelize or scale up
- 🟡 Hold comparisons to a fixed budget: same data, split, evaluation, step count, and timeout; changing the budget starts a new experiment, and scores are never compared across budgets
- 🟡 Handle failures as a ladder: lower per-device batch and raise gradient accumulation proportionally → enable gradient checkpointing → move to a larger GPU
- 🟡 Run experiments on a dedicated branch or tag, never on main; launch through the single entrypoint (Makefile/script) instead of calling the trainer or container directly; confirm the interpreter and environment first, and never create a venv or install dependencies on your own
- 🟡 Size timeouts to the job; a platform default that cannot finish the run counts as a misconfiguration
- 🟡 Tune hyperparameters with a sweep script, not one at a time; keep the rest of the budget fixed while sweeping one axis

**DO NOT**
- 🔴 Do not change the method or the evaluation protocol because of OOM or timeout (SFT→LoRA, shorter sequences, disabling monitoring all count as switching methods); if the original approach truly cannot work, explain why and ask
- 🔴 Do not kill or overwrite a running experiment; get explicit consent before deleting or resetting runs/checkpoints
- 🔴 Do not launch unbounded concurrent training jobs; every job carries a timeout

---

## 4. Reproducibility and the Run Ledger

> WHY: Randomness plus parallel non-determinism makes "run it twice" the only credible reproducibility evidence; without a ledger you cannot tell which run was the baseline.

**DO**
- 🟡 State the seed count, aggregation rule, and the hyperparameter search space and selection rule (mean/median/interval over seeds; a single run is never presented as a deterministic conclusion)
- 🟡 Every run writes a config snapshot, environment versions (framework/driver/CUDA), logs, and artifact paths
- 🟡 The run ledger is append-only: commit, config digest, primary metric, wall-clock, status (keep/discard/crash), artifacts
- 🟡 Change one axis per round; results from multi-axis changes cannot be attributed
- 🟡 Keep criterion: keep a change only for a material improvement; a comparable score with simpler or faster behavior also wins; a tiny gain bought with brittle code or clearly higher runtime is not kept
- 🟡 Rerun twice on the same data and compare aggregate metrics and per-example predictions; after a mid-training crash, the run must restore from a checkpoint
- 🟡 Label runs exploratory or confirmatory; exploratory runs are never evidence for the main claim
- 🟡 After several rounds without improvement, read the literature and citation graph first and extract recipes of the form dataset + method + hyperparameters → score; do not randomly jitter hyperparameters

**DO NOT**
- 🔴 Do not overwrite an existing run directory (a new run gets a new directory); runs/, logs, and checkpoints stay out of version control — commit only the ledger and config snapshots
- 🔴 Do not hand-edit ledger rows to "correct" a score

---

## 5. Code, Dependencies, and Environment

> WHY: ML library APIs and defaults drift fast; writing from memory produces arguments that do not exist.

**DO**
- 🟡 Start training scripts from current-version examples and docs; verify signatures and defaults before writing
- 🟡 Pin dependency versions; validate CUDA, bf16, and multi-GPU paths on GPU hardware — never fake a pass on CPU
- 🟡 Run long training in the background with logs and artifacts on disk; publish the monitoring dashboard URL at the start
- 🟡 Disable progress bars, log metrics per step, and log the first step, so logs stay line-parseable

**DO NOT**
- 🔴 Do not swallow exceptions, disable assertions/warnings, hardcode values to get past an error, or mock the real training pipeline to make a flow "run"
- 🔴 Do not pull dataset contents into the model context; inspect via sampling, statistics, and schema

---

## 6. Large Artifacts and External Sources

> WHY: Large files from international sources are often unusable in mainland China; silently switching sources changes artifacts, caches, and reproducibility.

**DO**
- 🟡 Before a single artifact or install ≥ 1GB, choose the source: explicit > project-configured trusted source (e.g. a domestic mirror) > international official source, and confirm it serves the target version; if unavailable, fail explicitly and print how to switch; config changes require the user to choose — in non-interactive environments read config only
- 🟡 After download, verify size and hash against official metadata; record source, version, and hash

**DO NOT**
- 🔴 Do not switch sources silently based on IP, timezone, or language; probing is only for recommendations
- 🔴 Do not silently fall back when a package is missing, a version mismatches, or verification fails; fail explicitly, or fall back after user confirmation and record why
- 🔴 Do not make third-party community mirrors a default source; a project must add them to its trusted list explicitly

**REQUIRE**
- 🟡 Ecosystem-level (pip/npm/go/cargo/apt/docker) changes go through index or registry; artifact-level (models/datasets/direct links) resolves per artifact — do not mix the two

---

## 7. Reporting Results

> WHY: Review and retrospectives look for checkable evidence; "best run" and missing variance both read as unstable conclusions.

**DO**
- 🟡 Write "expected X, observed Y"; explain the gap, or mark it unexplained
- 🟡 Disclose compute down to hardware model and count, wall-clock, per-run and total; include the cost of failures and preliminary runs
- 🟡 Give variance or intervals, and state the variability source (seed, initialization, data order) and the method (sd or sem)
- 🟡 Record negative results honestly: which axis did not help, and under what budget
- 🟡 Attach a model card and a dataset card on delivery or external release: intended use and limits, data provenance and license, evaluation scope and known failure modes

**DO NOT**
- 🔴 Do not use a single best run to represent the method, and do not omit failed runs
- 🔴 Do not present unverified inferences as conclusions

---

## 8. Baseline Safety

**DO**
- 🟡 Put temporary artifacts under `tmp/<date>/` and never commit them
- 🟡 Let errors propagate by default; catch only when handling changes the outcome, handle once, and log

**DO NOT**
- 🔴 Do not invent data, field names, metric values, URLs, or API shapes; when missing, stop and ask
- 🔴 Destructive commands (deleting weights/datasets/runs, `git reset --hard`, `rm -rf`) require stating the blast radius and getting explicit consent first
- 🔴 Secrets and `.env` never enter version control; logs never print credentials
