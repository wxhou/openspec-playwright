import { describe, it, expect } from "vitest";
import { join } from "path";
import { versionMismatchLines } from "../src/commands/update.js";

// 0.3.104: `openspec-pw update` reinstalled a stale "latest" from npm's
// packument cache, then blamed a devDependency that did not exist (the copy
// had resolved from the global prefix). The advice now depends on where the
// running copy actually came from.

const ROOT = "/proj";
const LOADED = "0.3.103";
const LATEST = "0.3.104";

describe("version mismatch advice", () => {
  it("blames the devDependency when the copy resolved from the project", () => {
    const text = versionMismatchLines(
      join(ROOT, "node_modules", "openspec-playwright", "package.json"),
      ROOT,
      LOADED,
      LATEST,
    ).join("\n");
    expect(text).toContain("devDependency");
    expect(text).toContain("npm uninstall openspec-playwright");
    expect(text).not.toContain("--prefer-online");
  });

  it("reports a stale global install when the copy resolved outside the project", () => {
    const text = versionMismatchLines(
      "/usr/local/lib/node_modules/openspec-playwright/package.json",
      ROOT,
      LOADED,
      LATEST,
    ).join("\n");
    expect(text).toContain("global install is outdated");
    expect(text).toContain(
      "npm install -g openspec-playwright@latest --prefer-online",
    );
    expect(text).not.toContain("devDependency");
  });

  it("reports both versions and the resolved directory without the file name", () => {
    const lines = versionMismatchLines(
      "/usr/local/lib/node_modules/openspec-playwright/package.json",
      ROOT,
      LOADED,
      LATEST,
    );
    expect(lines[0]).toContain(`loaded ${LOADED}`);
    expect(lines[0]).toContain(`latest ${LATEST}`);
    expect(lines[1]).toContain("/usr/local/lib/node_modules/openspec-playwright");
    expect(lines[1]).not.toContain("package.json");
  });

  it("does not treat a sibling directory as project-local", () => {
    // "/proj-old/node_modules/..." must not match "/proj/node_modules/"
    const text = versionMismatchLines(
      "/proj-old/node_modules/openspec-playwright/package.json",
      ROOT,
      LOADED,
      LATEST,
    ).join("\n");
    expect(text).toContain("global install is outdated");
  });
});
