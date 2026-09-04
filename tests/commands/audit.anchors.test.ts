import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, rmSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// audit() shells `npx openspec list` — stub it so runs stay hermetic.
vi.mock("child_process", () => ({
  execFileSync: vi.fn(() => "[]"),
}));

import { audit } from "../../src/commands/audit.js";
import {
  extractSpecAnchors,
  extractFixmeLines,
} from "../../src/commands/audit.js";

describe("anchor pure functions", () => {
  it("extracts // spec: anchors (zh titles, multiple per file, true line indices)", () => {
    const content = [
      "// spec: coupon#优惠券七天后过期",
      "test('coupon expires', async ({ page }) => {});",
      "",
      "// spec: user-auth#API login returns token",
      "test('login', async ({ page }) => {});",
    ].join("\n");
    const anchors = extractSpecAnchors(content);
    expect(anchors).toHaveLength(2);
    expect(anchors[0]).toEqual({
      capability: "coupon",
      requirementTitle: "优惠券七天后过期",
      line: 0,
    });
    expect(anchors[1].capability).toBe("user-auth");
    expect(anchors[1].line).toBe(3);
  });

  it("duplicate anchor texts keep distinct line indices (no first-match collapse)", () => {
    const content = [
      "// spec: coupon#同 requirement",
      "test('a', async ({ page }) => {});",
      "// spec: coupon#同 requirement",
      "test('b', async ({ page }) => {});",
    ].join("\n");
    const anchors = extractSpecAnchors(content);
    expect(anchors.map((a) => a.line)).toEqual([0, 2]);
  });

  it("returns [] for anchor-free content", () => {
    expect(extractSpecAnchors("test('a', () => {});\nconst x = 1;")).toEqual([]);
  });

  it("fixme block detection marks the fixme test's lines", () => {
    const content = [
      "test('healthy', async ({ page }) => {",
      "});",
      "",
      "test.fixme('stale on purpose', async ({ page }) => {",
      "  // spec: coupon#优惠券七天后过期",
      "});",
    ].join("\n");
    const fixme = extractFixmeLines(content);
    // Lines 3..5 are the fixme block (0-based); line 0-1 are healthy.
    expect(fixme.has(3)).toBe(true);
    expect(fixme.has(5)).toBe(true);
    expect(fixme.has(0)).toBe(false);
  });
});

describe("audit spec-anchor check (fixture)", () => {
  let root: string;
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let logs: string[];
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    root = join(tmpdir(), `ospw-pw-anchor-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(join(root, "tests", "playwright", "changes", "coupon"), { recursive: true });
    mkdirSync(join(root, "openspec", "specs", "coupon"), { recursive: true });
    mkdirSync(join(root, "openspec", "specs", "user-auth"), { recursive: true });
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(root);
    logs = [];
    logSpy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.join(" "));
    });
    // No app server → sitemap fetch fails fast; the anchor check is fs-only.
  });

  afterEach(() => {
    cwdSpy.mockRestore();
    logSpy.mockRestore();
    rmSync(root, { recursive: true, force: true });
  });

  const writeMainSpec = (cap: string, titles: string[]) => {
    const body = titles.map((t) => `### Requirement: ${t}`).join("\n\n");
    writeFileSync(join(root, "openspec", "specs", cap, "spec.md"), `# ${cap}\n\n## Requirements\n\n${body}\n`);
  };

  const writeTestFile = (name: string, body: string) => {
    writeFileSync(join(root, "tests", "playwright", "changes", name, `${name}.spec.ts`), body);
  };

  const report = () => logs.join("\n");

  it("a. anchored test with requirement still in main spec → zero reports", async () => {
    writeMainSpec("coupon", ["优惠券七天后过期"]);
    writeTestFile("coupon", [
      "// spec: coupon#优惠券七天后过期",
      "test('coupon expires', async ({ page }) => {",
      "  await page.goto('/');",
      "});",
    ].join("\n"));
    await audit();
    expect(report()).not.toContain("Anchored to removed requirement");
    expect(report()).not.toContain("spec anchors");
  });

  it("b. requirement deleted + archived REMOVED delta → report cites the change", async () => {
    writeMainSpec("coupon", ["别的 requirement"]); // title gone from main
    writeTestFile("coupon", [
      "// spec: coupon#优惠券七天后过期",
      "test('coupon expires', async ({ page }) => {",
      "});",
    ].join("\n"));
    const archived = join(root, "openspec", "changes", "archive", "2026-09-01-remove-coupon");
    mkdirSync(join(archived, "specs", "coupon"), { recursive: true });
    writeFileSync(
      join(archived, "specs", "coupon", "spec.md"),
      "## REMOVED Requirements\n\n### Requirement: 优惠券七天后过期\n",
    );
    await audit();
    expect(report()).toContain("Anchored to removed requirement");
    expect(report()).toContain("remove-coupon");
  });

  it("c. fixme'd test anchored to a deleted requirement → zero reports", async () => {
    writeMainSpec("coupon", []);
    writeTestFile("coupon", [
      "test.fixme('kept on purpose', async ({ page }) => {",
      "  // spec: coupon#优惠券七天后过期",
      "});",
    ].join("\n"));
    await audit();
    expect(report()).not.toContain("Anchored to removed requirement");
  });

  it("d. fully anchor-free change dir → one info line, no issue count", async () => {
    writeMainSpec("coupon", ["优惠券七天后过期"]);
    writeTestFile("coupon", [
      "test('legacy 1', async ({ page }) => {",
      "});",
      "test('legacy 2', async ({ page }) => {",
      "});",
    ].join("\n"));
    await audit();
    const r = report();
    expect(r).toMatch(/ℹ changes\/coupon\/ — 2 test\(s\) without spec anchors/);
    // info lines never join the issue count
    expect(r).not.toContain("Anchored to retired capability");
    expect(existsSync(join(root, "tests", "playwright", "changes", "coupon", "coupon.spec.ts"))).toBe(true);
  });

  it("capability directory missing → separate issue class", async () => {
    rmSync(join(root, "openspec", "specs", "user-auth"), { recursive: true, force: true });
    mkdirSync(join(root, "tests", "playwright", "changes", "user-auth"), { recursive: true });
    writeTestFile("user-auth", [
      "// spec: user-auth#API login returns token",
      "test('login', async ({ page }) => {",
      "});",
    ].join("\n"));
    await audit();
    expect(report()).toContain("Anchored to retired capability");
    expect(report()).not.toContain("Anchored to removed requirement");
  });
});
