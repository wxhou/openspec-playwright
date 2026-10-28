import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import { join } from "path";

import {
  MANAGED_GITIGNORE_PATHS,
  LOCKED_GITIGNORE_PATHS,
  skippableManagedPaths,
  readManagedSkips,
  GITIGNORE_BLOCK_BEGIN,
  GITIGNORE_BLOCK_END,
  findUncoveredManagedPaths,
  ensureGitignoreEntries,
  removeManagedBlock,
  detectTrackedFiles,
} from "../src/shared/gitignore-managed.js";

let projectRoot: string;

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), "ospw-managed-gitignore-"));
});

afterEach(() => {
  rmSync(projectRoot, { recursive: true, force: true });
});

describe("managed gitignore coverage for the MiniMax Code skill root", () => {
  it("covers the tool-owned skill dir, not the whole .agents/ tree", () => {
    expect(MANAGED_GITIGNORE_PATHS).toContain(".agents/skills/opsx-e2e/");
    // The rest of .agents/ belongs to the user — it must stay committable.
    expect(MANAGED_GITIGNORE_PATHS).not.toContain(".agents/");
    expect(findUncoveredManagedPaths(projectRoot)).toContain(
      ".agents/skills/opsx-e2e/",
    );
  });

  it("writes the skill dir into the managed block and reports it covered afterwards", () => {
    const result = ensureGitignoreEntries(projectRoot);
    expect(result.changed).toBe(true);
    const block = readFileSync(join(projectRoot, ".gitignore"), "utf-8");
    expect(block).toContain(".agents/skills/opsx-e2e/");
    expect(findUncoveredManagedPaths(projectRoot)).not.toContain(
      ".agents/skills/opsx-e2e/",
    );
  });
});

describe("managed gitignore coverage for the DeepSeek Harness skill root", () => {
  it("covers the tool-owned skill dir, not the whole .dsh/ tree", () => {
    expect(MANAGED_GITIGNORE_PATHS).toContain(".dsh/skills/opsx-e2e/");
    // OpenSpec writes its own openspec-* skills there; those stay committable.
    expect(MANAGED_GITIGNORE_PATHS).not.toContain(".dsh/");
    expect(findUncoveredManagedPaths(projectRoot)).toContain(
      ".dsh/skills/opsx-e2e/",
    );
  });

  it("writes the skill dir into the managed block and reports it covered afterwards", () => {
    ensureGitignoreEntries(projectRoot);
    const block = readFileSync(join(projectRoot, ".gitignore"), "utf-8");
    expect(block).toContain(".dsh/skills/opsx-e2e/");
    expect(findUncoveredManagedPaths(projectRoot)).not.toContain(
      ".dsh/skills/opsx-e2e/",
    );
  });
});

describe("findUncoveredManagedPaths", () => {
  it("is existence-independent: non-existent paths count as uncovered (review B1)", () => {
    const uncovered = findUncoveredManagedPaths(projectRoot);
    expect(uncovered).toContain("tests/playwright/test-results/"); // not on disk yet
    expect(uncovered).toContain("tests/playwright/credentials.yaml.bak");
    expect(uncovered).toHaveLength(MANAGED_GITIGNORE_PATHS.length);
  });
});

describe("ensureGitignoreEntries", () => {
  it("creates a gitignore containing only the block when none exists (task 3.1)", () => {
    const result = ensureGitignoreEntries(projectRoot);
    expect(result.changed).toBe(true);
    expect(result.added).toHaveLength(MANAGED_GITIGNORE_PATHS.length);

    const content = readFileSync(join(projectRoot, ".gitignore"), "utf-8");
    expect(content).toContain(GITIGNORE_BLOCK_BEGIN);
    expect(content).toContain("tests/playwright/test-results/");
    expect(content).toContain(GITIGNORE_BLOCK_END);
  });

  it("appends the block after user rules, preserving them byte-for-byte (task 3.1)", () => {
    const user = "# my rules\nnode_modules/\n.env\n";
    writeFileSync(join(projectRoot, ".gitignore"), user);

    ensureGitignoreEntries(projectRoot);

    const after = readFileSync(join(projectRoot, ".gitignore"), "utf-8");
    expect(after.startsWith(user)).toBe(true);
    expect(after).toContain("# openspec-pw: begin managed block");
    // no stray blank line: block joins directly after the trailing newline
    expect(after.slice(user.length, user.length + 2)).toBe("# ");
  });

  it("does not double the trailing newline (task 3.1 / review O3)", () => {
    const user = "# rules\n"; // already ends with a newline
    writeFileSync(join(projectRoot, ".gitignore"), user);
    ensureGitignoreEntries(projectRoot);
    const after = readFileSync(join(projectRoot, ".gitignore"), "utf-8");
    expect(after).not.toContain("# rules\n\n#");
  });

  it("is idempotent when all paths are already covered (task 3.2)", () => {
    ensureGitignoreEntries(projectRoot);
    const before = readFileSync(join(projectRoot, ".gitignore"), "utf-8");
    const result = ensureGitignoreEntries(projectRoot);
    expect(result.changed).toBe(false);
    expect(readFileSync(join(projectRoot, ".gitignore"), "utf-8")).toBe(before);
  });

  it("wide rules covering the tests trio still let other managed paths in (task 3.4)", () => {
    writeFileSync(join(projectRoot, ".gitignore"), "tests/\n");
    const result = ensureGitignoreEntries(projectRoot);
    // `tests/` covers the trio, the other 15 managed names are still added
    expect(result.added).not.toContain("tests/playwright/test-results/");
    expect(result.added).not.toContain("tests/playwright/credentials.yaml");
    expect(result.added).toContain(".claude/");
    const after = readFileSync(join(projectRoot, ".gitignore"), "utf-8");
    expect(after).not.toContain("tests/playwright/credentials.yaml\n");
  });

  it("covers tool-local data, mcp config, and auth credentials (user-decided batch, 2026-09)", () => {
    ensureGitignoreEntries(projectRoot);
    const content = readFileSync(join(projectRoot, ".gitignore"), "utf-8");
    for (const p of [".codegraph/", ".playwright-mcp/", ".mcp.json", "playwright/.auth/"]) {
      expect(content).toContain(p);
    }
  });

  it("covers exploration screenshots (user-decided, 2026-10)", () => {
    ensureGitignoreEntries(projectRoot);
    const content = readFileSync(join(projectRoot, ".gitignore"), "utf-8");
    expect(content).toContain("tests/playwright/screenshots/");
  });

  it("zero action when user rules cover ALL managed paths (task 3.2)", () => {
    writeFileSync(
      join(projectRoot, ".gitignore"),
      MANAGED_GITIGNORE_PATHS.join("\n") + "\n",
    );
    const before = readFileSync(join(projectRoot, ".gitignore"), "utf-8");
    const result = ensureGitignoreEntries(projectRoot);
    expect(result.changed).toBe(false);
    expect(readFileSync(join(projectRoot, ".gitignore"), "utf-8")).toBe(before);
  });

  it("repairs a partially-deleted block: adds only missing lines (task 3.3)", () => {
    writeFileSync(
      join(projectRoot, ".gitignore"),
      `${GITIGNORE_BLOCK_BEGIN}\ntests/playwright/test-results/\n${GITIGNORE_BLOCK_END}\n`,
    );
    const result = ensureGitignoreEntries(projectRoot);
    expect(result.changed).toBe(true);
    const after = readFileSync(join(projectRoot, ".gitignore"), "utf-8");
    expect(after).toContain("tests/playwright/credentials.yaml");
    expect(after).toContain(".claude/");
    // no duplicate block appended
    expect(after.split(GITIGNORE_BLOCK_BEGIN)).toHaveLength(2);
  });

  it("tolerates CRLF .gitignore without duplicating the block (task 3.6 / review S1)", () => {
    const crlf = `${GITIGNORE_BLOCK_BEGIN}\r\ntests/playwright/test-results/\r\n${GITIGNORE_BLOCK_END}\r\n`;
    writeFileSync(join(projectRoot, ".gitignore"), crlf);
    const result = ensureGitignoreEntries(projectRoot);
    expect(result.changed).toBe(true); // missing lines are added
    const after = readFileSync(join(projectRoot, ".gitignore"), "utf-8");
    expect(after.split(GITIGNORE_BLOCK_BEGIN)).toHaveLength(2); // still one block
    // no orphan begin/end markers
    expect(after.split(GITIGNORE_BLOCK_END)).toHaveLength(2);
  });

  it("treats orphan markers as no-block and appends a fresh one", () => {
    writeFileSync(
      join(projectRoot, ".gitignore"),
      `${GITIGNORE_BLOCK_BEGIN}\nuser kept line\n`,
    );
    const result = ensureGitignoreEntries(projectRoot);
    expect(result.changed).toBe(true);
    const after = readFileSync(join(projectRoot, ".gitignore"), "utf-8");
    expect(after).toContain("user kept line"); // orphan stays
    expect(after.split(GITIGNORE_BLOCK_BEGIN)).toHaveLength(3); // orphan + fresh
  });
});

describe("removeManagedBlock", () => {
  it("removes the block, keeps user lines, deletes empty file (task 3.8)", () => {
    writeFileSync(join(projectRoot, ".gitignore"), "# mine\nnode_modules/\n");
    ensureGitignoreEntries(projectRoot);
    const result = removeManagedBlock(projectRoot);
    expect(result.removed).toBe(true);
    expect(result.fileDeleted).toBe(false);
    expect(readFileSync(join(projectRoot, ".gitignore"), "utf-8")).toBe(
      "# mine\nnode_modules/\n",
    );
  });

  it("deletes the file when the block was the only content", () => {
    ensureGitignoreEntries(projectRoot);
    const result = removeManagedBlock(projectRoot);
    expect(result.fileDeleted).toBe(true);
    expect(existsSync(join(projectRoot, ".gitignore"))).toBe(false);
  });

  it("is a no-op without a block (idempotent)", () => {
    writeFileSync(join(projectRoot, ".gitignore"), "# mine\n");
    const result = removeManagedBlock(projectRoot);
    expect(result.removed).toBe(false);
    expect(readFileSync(join(projectRoot, ".gitignore"), "utf-8")).toBe("# mine\n");
  });

  it("removes only the block; blank-line structure outside stays byte-identical (task 3.8 / review F5)", () => {
    const user = "# mine\n\n\n\n\n# tail\n";
    writeFileSync(
      join(projectRoot, ".gitignore"),
      user + GITIGNORE_BLOCK_BEGIN + "\nx\n" + GITIGNORE_BLOCK_END + "\n",
    );
    const result = removeManagedBlock(projectRoot);
    expect(result.removed).toBe(true);
    expect(result.fileDeleted).toBe(false);
    // The user's deliberate blank runs are NOT collapsed — byte-for-byte.
    expect(readFileSync(join(projectRoot, ".gitignore"), "utf-8")).toBe(user);
  });
});

describe("ensureGitignoreEntries with omitted paths", () => {
  it("never adds an omitted path to a fresh block", () => {
    const result = ensureGitignoreEntries(projectRoot, { omit: ["openspec/"] });
    expect(result.added).not.toContain("openspec/");
    expect(readFileSync(join(projectRoot, ".gitignore"), "utf-8")).not.toContain(
      "openspec/",
    );
  });

  it("drops an omitted path from an existing block and does not re-add it", () => {
    ensureGitignoreEntries(projectRoot);
    expect(readFileSync(join(projectRoot, ".gitignore"), "utf-8")).toContain(
      "openspec/",
    );

    const result = ensureGitignoreEntries(projectRoot, { omit: ["openspec/"] });
    expect(result.removed).toEqual(["openspec/"]);
    expect(result.changed).toBe(true);

    const after = readFileSync(join(projectRoot, ".gitignore"), "utf-8");
    expect(after).not.toContain("openspec/");
    expect(after).toContain(".claude/");
    expect(after.split(GITIGNORE_BLOCK_BEGIN)).toHaveLength(2);
  });

  it("leaves a user rule outside the block untouched", () => {
    const user = "openspec/\n";
    writeFileSync(join(projectRoot, ".gitignore"), user);
    ensureGitignoreEntries(projectRoot, { omit: ["openspec/"] });
    const after = readFileSync(join(projectRoot, ".gitignore"), "utf-8");
    expect(after.startsWith(user)).toBe(true);
  });

  it("reports no removal when the block never had the path", () => {
    const result = ensureGitignoreEntries(projectRoot, { omit: ["openspec/"] });
    expect(result.removed).toEqual([]);
  });
});

describe("detectTrackedFiles (task 3.9)", () => {
  it("returns [] outside a git repo (no .git)", () => {
    expect(detectTrackedFiles(projectRoot)).toEqual([]);
  });

  it("reports tracked managed paths with per-directory aggregation", async () => {
    const { execFileSync } = await import("child_process");
    // Turn the tmp project into a real repo and commit a credential file
    const run = (...args: string[]) =>
      execFileSync("git", ["-C", projectRoot, ...args], { encoding: "utf-8" });
    run("init");
    run("config", "user.email", "t@t");
    run("config", "user.name", "t");
    mkdirSync(join(projectRoot, "tests", "playwright"), { recursive: true });
    writeFileSync(join(projectRoot, "tests", "playwright", "credentials.yaml"), "api: x");
    run("add", "tests/playwright/credentials.yaml");
    run("commit", "-m", "leak", "--no-gpg-sign");

    const tracked = detectTrackedFiles(projectRoot);
    expect(tracked.some((t) => t.startsWith("tests/playwright/credentials.yaml"))).toBe(true);
  });

  it("does not report an omitted path as needing git rm --cached", async () => {
    const { execFileSync } = await import("child_process");
    const run = (...args: string[]) =>
      execFileSync("git", ["-C", projectRoot, ...args], { encoding: "utf-8" });
    run("init");
    run("config", "user.email", "t@t");
    run("config", "user.name", "t");
    mkdirSync(join(projectRoot, "openspec", "specs"), { recursive: true });
    writeFileSync(join(projectRoot, "openspec", "specs", "spec.md"), "# x\n");
    run("add", "openspec/specs/spec.md");
    run("commit", "-m", "specs", "--no-gpg-sign");

    expect(
      detectTrackedFiles(projectRoot).some((t) => t.startsWith("openspec/")),
    ).toBe(true);
    expect(
      detectTrackedFiles(projectRoot, ["openspec/"]).some((t) =>
        t.startsWith("openspec/"),
      ),
    ).toBe(false);
  });
});

describe("init-time opt-outs recorded in the block header", () => {
  const readBlock = () =>
    readFileSync(join(projectRoot, ".gitignore"), "utf-8");

  it("keeps the rule carriers out of the candidate set", () => {
    expect([...LOCKED_GITIGNORE_PATHS]).toEqual(["AGENTS.md", "CLAUDE.md"]);
    const candidates = skippableManagedPaths();
    expect(candidates).not.toContain("AGENTS.md");
    expect(candidates).not.toContain("CLAUDE.md");
    expect(candidates).toContain(".claude/");
    expect(skippableManagedPaths(["tmp/"])).not.toContain("tmp/");
  });

  it("records the opted-out paths and leaves them out of the block", () => {
    const result = ensureGitignoreEntries(projectRoot, {
      skip: ["tmp/", "tests/playwright/credentials.yaml"],
    });
    expect(result.changed).toBe(true);
    const block = readBlock();
    expect(block).toContain(
      "# openspec-pw: skip=tmp/,tests/playwright/credentials.yaml",
    );
    expect(block).not.toContain("\ntmp/\n");
    expect(block).not.toContain("\ntests/playwright/credentials.yaml\n");
    expect(readManagedSkips(projectRoot)).toEqual([
      "tmp/",
      "tests/playwright/credentials.yaml",
    ]);
  });

  it("is idempotent: a second run with the same opt-outs writes nothing", () => {
    ensureGitignoreEntries(projectRoot, { skip: ["tmp/"] });
    const second = ensureGitignoreEntries(projectRoot, { skip: ["tmp/"] });
    expect(second.changed).toBe(false);
    expect(readBlock().match(/openspec-pw: skip=/g)).toHaveLength(1);
  });

  it("clears the record and re-covers the paths when the opt-out is dropped", () => {
    ensureGitignoreEntries(projectRoot, { skip: ["tmp/"] });
    const result = ensureGitignoreEntries(projectRoot, { skip: [] });
    expect(result.added).toContain("tmp/");
    expect(readBlock()).not.toContain("openspec-pw: skip=");
    expect(readManagedSkips(projectRoot)).toEqual([]);
  });

  it("leaves a recorded opt-out alone when the caller passes no skip at all", () => {
    ensureGitignoreEntries(projectRoot, { skip: ["tmp/"] });
    ensureGitignoreEntries(projectRoot);
    expect(readManagedSkips(projectRoot)).toEqual(["tmp/"]);
  });

  it("does not record a pipeline-only omit", () => {
    ensureGitignoreEntries(projectRoot, { omit: ["openspec/"] });
    expect(readBlock()).not.toContain("openspec-pw: skip=");
    expect(readBlock()).not.toContain("\nopenspec/\n");
  });

  it("update's read → ensure composition keeps a recorded opt-out", () => {
    ensureGitignoreEntries(projectRoot, { skip: ["tmp/"] });
    ensureGitignoreEntries(projectRoot, {
      skip: readManagedSkips(projectRoot),
    });
    expect(readBlock()).not.toContain("\ntmp/\n");
    expect(readManagedSkips(projectRoot)).toEqual(["tmp/"]);
  });
});
