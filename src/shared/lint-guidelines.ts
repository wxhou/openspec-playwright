/**
 * Swallow-error clause → lint rule checklist data (lint-guidelines capability).
 * Single source of truth for rule ids; templates/lint-guidelines.md is paired
 * with this data and pinned by a checksum test (docs-sync pattern: drift is a
 * CI failure, both sides update in the same commit).
 */
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { bundledTemplatePath } from "./drift.js";
import { normalizeEol } from "../commands/editors/agents.js";

export interface LintRuleEntry {
  /** Rule id as written in linter config/docs. */
  id: string;
  /** Linter that owns the rule. */
  tool: "ESLint" | "ruff" | "pylint";
  /** What shape of swallowed failure fires the rule. */
  semantics: string;
  /** Enabled by the linter's default rule set (no config needed). */
  defaultOn: boolean;
  /** Trigger scope — what the rule deliberately does NOT flag. */
  scope: string;
}

export const LINT_GUIDELINE_RULES: LintRuleEntry[] = [
  {
    id: "no-empty",
    tool: "ESLint",
    semantics: "empty catch block with no comment",
    defaultOn: true,
    scope: "blocks containing a comment are exempt — the black hole survives, human review carries it.",
  },
  {
    id: "E722",
    tool: "ruff",
    semantics: "bare `except:`",
    defaultOn: true,
    scope: "typed handlers only (narrow catches are not flagged)",
  },
  {
    id: "S110",
    tool: "ruff",
    semantics: "`except Exception: pass`",
    defaultOn: true,
    scope: "broad or bare handlers only; `pass` body",
  },
  {
    id: "S112",
    tool: "ruff",
    semantics: "`except Exception: continue`",
    defaultOn: true,
    scope: "broad or bare handlers only; `continue` body",
  },
  {
    id: "BLE001",
    tool: "ruff",
    semantics: "blind `except Exception` / `except BaseException`",
    defaultOn: true,
    scope: "not flagged when the handler logs with exc_info enabled (logged-exempt).",
  },
  {
    id: "B904",
    tool: "ruff",
    semantics: "`raise` inside an except handler without `from` (dropped causality; rethrown as-is exempt)",
    defaultOn: false,
    scope: "opt-in via select/extend-select of rule id or bugbear category `B`, or `ALL`",
  },
  {
    id: "W0702",
    tool: "pylint",
    semantics: "bare-except",
    defaultOn: true,
    scope: "pylint's default rule set; disabled only by project config",
  },
  {
    id: "W0718",
    tool: "pylint",
    semantics: "broad-exception-caught",
    defaultOn: true,
    scope: "pylint's default rule set; disabled only by project config",
  },
  {
    id: "W0707",
    tool: "pylint",
    semantics: "raise-missing-from (dropped causality)",
    defaultOn: true,
    scope: "pylint's default rule set; disabled only by project config",
  },
];

/** Project-relative checklist file path (editor-agnostic reference asset). */
export const LINT_GUIDELINES_RELPATH = "lint-guidelines.md";

/** Checksum line prefix — content hash is computed excluding this line itself. */
export const LINT_GUIDELINES_CHECKSUM_PREFIX =
  "<!-- openspec-pw: lint-guidelines ";

/**
 * Ownership checksum: sha256 of the checklist body with the checksum line
 * removed, truncated to 8 hex chars. The checksum line must be stripped from
 * the input it hashes (self-reference would deadlock the comparison).
 */
export function computeChecklistChecksum(body: string): string {
  const withoutChecksum = body
    .split("\n")
    .filter((line) => !line.startsWith(LINT_GUIDELINES_CHECKSUM_PREFIX))
    .join("\n");
  return createHash("sha256").update(withoutChecksum).digest("hex").slice(0, 8);
}

/** True when the file's checksum line matches the file body (tool-owned). */
export function isChecklistUnmodified(content: string): boolean {
  const lines = content.split("\n");
  const checksumLine = lines.find((l) =>
    l.startsWith(LINT_GUIDELINES_CHECKSUM_PREFIX),
  );
  if (!checksumLine) return false;
  const expected = checksumLine
    .slice(LINT_GUIDELINES_CHECKSUM_PREFIX.length)
    .replace(/ -->$/, "")
    .trim();
  if (!/^[0-9a-f]{8}$/.test(expected)) return false;
  return computeChecklistChecksum(content) === expected;
}

export type ChecklistDisposition =
  | "created"
  | "unchanged"
  | "refreshed"
  | "kept-modified";

/** Uninstall-side disposition for the checklist file. */
export type ChecklistRemovalDisposition = "removed" | "kept-modified" | "absent";

/**
 * Uninstall the checklist: tool-owned (checksum intact) → remove;
 * user-modified → keep and report; missing → nothing to do.
 */
export function removeChecklist(
  projectRoot: string,
): ChecklistRemovalDisposition {
  const dest = join(projectRoot, LINT_GUIDELINES_RELPATH);
  if (!existsSync(dest)) return "absent";
  if (isChecklistUnmodified(readFileSync(dest, "utf-8"))) {
    rmSync(dest);
    return "removed";
  }
  return "kept-modified";
}

/**
 * Install or refresh the checklist in the project root, content-based
 * ownership (vendored-agents semantics): missing → copy; identical → no-op;
 * never user-modified (checksum intact) → overwrite with latest; user-modified
 * → leave untouched (caller reports it).
 */
export function installOrRefreshChecklist(
  projectRoot: string,
): ChecklistDisposition {
  const templatePath = bundledTemplatePath(
    join("templates", "lint-guidelines.md"),
  );
  const latest = readFileSync(templatePath, "utf-8");
  const dest = join(projectRoot, LINT_GUIDELINES_RELPATH);
  if (!existsSync(dest)) {
    copyFileSync(templatePath, dest);
    return "created";
  }
  const current = readFileSync(dest, "utf-8");
  if (normalizeEol(current) === normalizeEol(latest)) return "unchanged";
  if (isChecklistUnmodified(current)) {
    writeFileSync(dest, latest);
    return "refreshed";
  }
  return "kept-modified";
}