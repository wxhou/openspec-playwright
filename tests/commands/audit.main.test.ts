import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock-heavy harness for audit()'s main function. The sibling file
// audit.test.ts keeps REAL filesystem semantics for getSitemapRoutes —
// vi.mock is hoisted file-wide, so these cases live separately.
vi.mock("fs", () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  readFileSync: vi.fn(),
}));
vi.mock("child_process", () => ({
  execFileSync: vi.fn(),
}));

import { existsSync, readdirSync, readFileSync } from "fs";
import { execFileSync } from "child_process";
import { join } from "path";
import { audit } from "../../src/commands/audit.js";

const existsSyncMock = vi.mocked(existsSync);
const readdirSyncMock = vi.mocked(readdirSync);
const readFileSyncMock = vi.mocked(readFileSync);
const execFileSyncMock = vi.mocked(execFileSync);

/** Minimal Dirent stand-in for collectSpecFiles (name + isDirectory only). */
function dirent(name: string, isDirectory: boolean) {
  return { name, isDirectory: () => isDirectory };
}

describe("audit main function", () => {
  const root = "/tmp/fake-project";
  const testsDir = join(root, "tests", "playwright");
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let fetchMock: ReturnType<typeof vi.fn>;

  /** Path-keyed fixture state, reset per test. */
  let existingPaths: Set<string>;
  let contentsByPath: Map<string, string>;
  let direntsByDir: Map<string, Array<ReturnType<typeof dirent>>>;
  let namesByDir: Map<string, string[]>;

  beforeEach(() => {
    vi.clearAllMocks();
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(root);
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // Short-circuit detectAppServer's port chain via env (it still walks
    // findNpmRoot/readPackageJson through the mocked fs — empty defaults
    // below keep those calls harmless).
    vi.stubEnv("BASE_URL", "http://localhost:9999");

    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        "<urlset><url><loc>http://localhost:9999/home</loc></url></urlset>",
    });
    vi.stubGlobal("fetch", fetchMock);

    existingPaths = new Set([testsDir]);
    contentsByPath = new Map();
    direntsByDir = new Map();
    namesByDir = new Map();

    existsSyncMock.mockImplementation((p) => existingPaths.has(String(p)));
    readFileSyncMock.mockImplementation(
      ((p: string) => contentsByPath.get(String(p)) ?? "") as unknown as typeof readFileSync,
    );
    readdirSyncMock.mockImplementation(
      (((p: string, opts?: { withFileTypes?: boolean }) => {
        const key = String(p);
        return opts?.withFileTypes
          ? (direntsByDir.get(key) ?? [])
          : (namesByDir.get(key) ?? []);
      }) as unknown) as typeof readdirSync,
    );
    // Default: openspec CLI reports zero changes
    execFileSyncMock.mockReturnValue("[]");
  });

  afterEach(() => {
    cwdSpy.mockRestore();
    logSpy.mockRestore();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  function logText(): string {
    return logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
  }

  it("exits early with a hint when tests/playwright/ is missing", async () => {
    existingPaths.clear();

    await audit();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(execFileSyncMock).not.toHaveBeenCalled();
    expect(logText()).toContain("tests/playwright/ not found");
    expect(logText()).toContain("openspec-pw init");
  });

  it("prints a gray note and continues when sitemap.xml is unreachable", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

    await audit();

    expect(logText()).toContain("ℹ");
    expect(logText()).toContain("sitemap.xml unreachable");
    expect(logText()).toContain("No issues found");
  });

  it("flags an orphaned root-level spec file with no matching change", async () => {
    direntsByDir.set(testsDir, [dirent("foo.spec.ts", false)]);
    execFileSyncMock.mockReturnValue(JSON.stringify([{ name: "bar" }]));

    await audit();

    expect(logText()).toContain("Orphaned spec file");
    expect(logText()).toContain("foo.spec.ts");
    // Orphan detail suggests migrating to changes/<name>/ (the literal
    // "openspec-pw migrate" hint is reserved for old-style locations).
    expect(logText()).toContain("No matching OpenSpec change found");
  });

  it("same setup reports nothing when the change list covers the file", async () => {
    direntsByDir.set(testsDir, [dirent("foo.spec.ts", false)]);
    // Empty change list → orphan guard (changeNames.length > 0) skips the flag
    execFileSyncMock.mockReturnValue("[]");

    await audit();

    expect(logText()).not.toContain("Orphaned spec file");
  });

  it("flags hardcoded URLs whose route is absent from the sitemap", async () => {
    direntsByDir.set(testsDir, [
      dirent("my-change.spec.ts", false),
      dirent("seed.spec.ts", false),
    ]);
    contentsByPath.set(
      join(testsDir, "my-change.spec.ts"),
      "await page.goto('https://localhost:9999/missing');",
    );
    contentsByPath.set(join(testsDir, "seed.spec.ts"), "");

    await audit();

    expect(logText()).toContain("Route not in sitemap");
    expect(logText()).toContain("/missing");
  });

  it("does not flag URLs under a sitemap route prefix", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        "<urlset><url><loc>http://localhost:9999/changes</loc></url></urlset>",
    });
    direntsByDir.set(testsDir, [dirent("my-change.spec.ts", false)]);
    contentsByPath.set(
      join(testsDir, "my-change.spec.ts"),
      "await page.goto('https://localhost:9999/changes/foo');",
    );

    await audit();

    expect(logText()).not.toContain("Route not in sitemap");
  });

  it("flags missing auth.setup.ts when specs reference protected routes", async () => {
    direntsByDir.set(testsDir, [dirent("my-change.spec.ts", false)]);
    contentsByPath.set(
      join(testsDir, "my-change.spec.ts"),
      "test.use({ storageState: 'auth.json' });",
    );
    // auth.setup.ts deliberately absent from existingPaths

    await audit();

    expect(logText()).toContain("Missing auth setup");
    expect(logText()).toContain("auth.setup.ts");
  });

  it("flags old-style root-level spec locations via the plain readdir scan", async () => {
    // Plain-string readdir (phase 6) sees the file; withFileTypes scan
    // (collectSpecFiles) sees nothing — isolates the old-style detector.
    namesByDir.set(testsDir, ["legacy.spec.ts"]);

    await audit();

    expect(logText()).toContain("Old-style file location");
    expect(logText()).toContain("openspec-pw migrate");
    expect(logText()).toContain("Suggested fixes");
  });

  it("reports healthy output and skips shared files", async () => {
    direntsByDir.set(testsDir, [
      dirent("seed.spec.ts", false),
      dirent("auth.setup.ts", false),
    ]);
    contentsByPath.set(join(testsDir, "seed.spec.ts"), "");
    namesByDir.set(testsDir, ["seed.spec.ts"]); // shared → phase 6 ignores it

    await audit();

    expect(logText()).toContain("No issues found");
    expect(logText()).not.toContain("Orphaned spec file");
    expect(logText()).not.toContain("Old-style file location");
  });
});
