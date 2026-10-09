#!/usr/bin/env node
/**
 * Regenerate the AGENTS.md mirror from employee-standards.md (the SSOT).
 *
 * The standards are hand-maintained in ONE place; this script rewrites
 * only the OPENSPEC-PW blocks in AGENTS.md so the mirror can never drift
 * the way it once did (the 0.3.93 batch was missing here after a hand
 * sync). Bytes outside the blocks — the title, the CodeGraph section,
 * CRLF line endings — are preserved verbatim.
 *
 * The CLAUDE_MD_ZH/EN embeds in docs/script.js are intentionally NOT
 * generated: they are a hand-condensed editorial copy for the landing
 * page (a UX decision, not a mechanical transform of the SSOT), and
 * tests/docs-sync.test.ts guards their sync instead.
 *
 * Usage:
 *   npm run standards:sync            # rewrite AGENTS.md when drifted
 *   npm run standards:sync -- --check # report drift, exit 1, no write
 */
import { existsSync, readFileSync, realpathSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";

export const OPENSPEC_PW_BEGIN = "<!-- OPENSPEC-PW:START -->";
export const OPENSPEC_PW_END = "<!-- OPENSPEC-PW:END -->";
const TITLE = "# openspec-playwright";

const USAGE = `Usage: npm run standards:sync [-- --check]
  --check   report drift, exit 1, never write
The tool syncs only the repo that contains it (script-anchored root).`;

export function parseArgs(argv) {
  let check = false;
  for (const arg of argv) {
    if (arg === "--check") {
      check = true;
    } else if (arg.startsWith("-")) {
      return { error: `unknown flag: ${arg}` };
    } else {
      return { error: `unexpected argument: ${arg} — the tool syncs its own repo` };
    }
  }
  return { check };
}

/** Normalize CRLF and lone CR to LF so a CRLF checkout (git autocrlf)
 * cannot leak bare \r into the block or double them on conversion. */
function normalizeLf(text) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/**
 * Pure builder: given the SSOT text and the current AGENTS.md text
 * (null or blank when the file does not effectively exist), return the
 * mirrored content.
 *
 * Byte discipline (same as the managed .gitignore block):
 * - The block's EOL adopts the existing file's dominant EOL, so a CRLF
 *   file is not left half-and-half.
 * - The marker pairs are tool territory: the first is replaced in place,
 *   any later pair is stale duplicate and is dropped (it would otherwise
 *   survive and grow on every run); BEGIN without a later END is
 *   malformed — refused, never consumed.
 * - Everything outside survives verbatim (F2), and the file's trailing
 *   newline state is kept exactly (F5): a file that ends without \n
 *   still ends without one.
 * - A file whose non-marker area holds no content (blanked, block-only,
 *   whitespace-only) regains the generated title — canonical fresh shape.
 * - No block at all: append at the tail; orphan markers stay (user-file
 *   content, same pairing policy as the managed gitignore block).
 */
export function buildMirrorContent(standards, existing) {
  const blockLf = `${OPENSPEC_PW_BEGIN}\n\n${normalizeLf(standards).trimEnd()}\n${OPENSPEC_PW_END}`;
  if (existing === null || existing.trim() === "") {
    return { content: `${TITLE}\n${blockLf}\n` };
  }
  const crlfCount = (existing.match(/\r\n/g) ?? []).length;
  const lfOnlyCount = (existing.match(/(?<!\r)\n/g) ?? []).length;
  const block = crlfCount > lfOnlyCount ? blockLf.replace(/\n/g, "\r\n") : blockLf;
  const nl = crlfCount > lfOnlyCount ? "\r\n" : "\n";

  const b = existing.indexOf(OPENSPEC_PW_BEGIN);
  if (b === -1) {
    const hadTrailingNewline = /\r?\n$/.test(existing);
    const body = existing.replace(/\r?\n+$/, "");
    return { content: body + nl + block + (hadTrailingNewline ? nl : "") };
  }
  const e = existing.indexOf(OPENSPEC_PW_END, b + OPENSPEC_PW_BEGIN.length);
  if (e === -1) return { error: "malformed markers" };
  let suffixStart = e + OPENSPEC_PW_END.length;
  for (;;) {
    const b2 = existing.indexOf(OPENSPEC_PW_BEGIN, suffixStart);
    if (b2 === -1) break;
    const e2 = existing.indexOf(OPENSPEC_PW_END, b2 + OPENSPEC_PW_BEGIN.length);
    if (e2 === -1) return { error: "malformed markers" };
    suffixStart = e2 + OPENSPEC_PW_END.length;
  }
  let prefix = existing.slice(0, b);
  if (prefix.trim() === "") prefix = TITLE + nl;
  return { content: prefix + block + existing.slice(suffixStart) };
}

/**
 * Sync AGENTS.md at `root` from employee-standards.md. With `check`,
 * report drift without writing (exit-code semantics belong to the CLI
 * wrapper below).
 */
export function syncAgentsMirror(root, { check = false } = {}) {
  const standardsPath = join(root, "employee-standards.md");
  if (!existsSync(standardsPath)) throw new Error(`SSOT not found: ${standardsPath}`);
  const standards = readFileSync(standardsPath, "utf-8");
  const agentsPath = join(root, "AGENTS.md");
  const existing = existsSync(agentsPath) ? readFileSync(agentsPath, "utf-8") : null;
  const built = buildMirrorContent(standards, existing);
  if (built.error) return { changed: false, error: built.error };
  if (built.content === existing) return { changed: false };
  if (!check) writeFileSync(agentsPath, built.content);
  return { changed: true, wrote: !check };
}

function main(argv) {
  const parsed = parseArgs(argv);
  if (parsed.error) {
    console.error(`${parsed.error}\n${USAGE}`);
    process.exit(1);
    return;
  }
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const result = syncAgentsMirror(root, { check: parsed.check });
  if (result.error) {
    console.error(`AGENTS.md has malformed OPENSPEC-PW markers — fix by hand, refusing to touch: ${result.error}`);
    process.exit(1);
    return;
  }
  if (!result.changed) {
    console.log("AGENTS.md already in sync with employee-standards.md");
    return;
  }
  if (check) {
    console.error("AGENTS.md drifted from employee-standards.md — run: npm run standards:sync");
    process.exit(1);
    return;
  }
  console.log("AGENTS.md regenerated from employee-standards.md");
}

// Run-guard via realpath: import.meta.url is the module's realpath, so a
// symlinked script or a symlinked ancestor directory (macOS ~/Documents,
// bind mounts) must be resolved before comparing — otherwise the guard
// never matches and the CLI silently no-ops (exit 0, nothing done).
if (process.argv[1]) {
  try {
    if (import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
      main(process.argv.slice(2));
    }
  } catch {
    /* argv path does not exist — cannot be this script; ignore */
  }
}
