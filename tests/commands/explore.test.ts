import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  parseExplorationFile,
  resolveExploreBaseUrl,
  updateExplorationFile,
  appendFailureSection,
} from "../../src/commands/explore.js";
import type { RouteResult } from "../../src/commands/explore.js";

const route = (path: string, status: RouteResult["status"]): RouteResult => ({
  path,
  url: `http://localhost:3000${path}`,
  status,
  snapshot: { formCount: 0, linkCount: 0 },
});
describe("explore parseExplorationFile", () => {
  it("returns the recorded BASE_URL when the line is present", () => {
    const parsed = parseExplorationFile(
      "BASE_URL: http://localhost:4000\n\n| /home | public | 200 | ready |",
    );
    expect(parsed.baseUrl).toBe("http://localhost:4000");
    expect(parsed.routes.length).toBe(1);
  });

  it("returns undefined when no BASE_URL line exists (pure function)", () => {
    const parsed = parseExplorationFile("| /home | public | 200 | ready |");
    expect(parsed.baseUrl).toBeUndefined();
    expect(parsed.routes.length).toBe(1);
  });
});

describe("explore base URL resolution", () => {
  const tmpDir = join(tmpdir(), "ospw-pw-explore-" + Date.now());

  beforeEach(() => {
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("env BASE_URL wins over recorded value and detection", () => {
    writeFileSync(
      join(tmpDir, "package.json"),
      JSON.stringify({ scripts: { dev: "vite" } }),
    );
    expect(
      resolveExploreBaseUrl(tmpDir, "http://localhost:4000", {
        BASE_URL: "http://localhost:9999",
      }),
    ).toBe("http://localhost:9999");
  });

  it("recorded file value beats detection", () => {
    writeFileSync(
      join(tmpDir, "package.json"),
      JSON.stringify({ scripts: { dev: "vite" } }),
    );
    expect(resolveExploreBaseUrl(tmpDir, "http://localhost:4000", {})).toBe(
      "http://localhost:4000",
    );
  });

  it("detection chain provides the port when nothing else is set", () => {
    writeFileSync(
      join(tmpDir, "package.json"),
      JSON.stringify({
        scripts: { dev: "vite" },
        devDependencies: { vite: "^8.0.0" },
      }),
    );
    expect(resolveExploreBaseUrl(tmpDir, undefined, {})).toBe(
      "http://localhost:5173",
    );
  });

  it("falls back to localhost:3000 when all sources fail", () => {
    expect(resolveExploreBaseUrl(tmpDir, undefined, {})).toBe(
      "http://localhost:3000",
    );
  });
});

describe("explore updateExplorationFile", () => {
  const file = [
    "BASE_URL: http://localhost:4000",
    "",
    "| Route | Auth | Status | Ready signal |",
    "|-------|------|--------|--------------|",
    "| /home | public | unexplored | ready |",
    "| /admin | auth | unexplored | ready |",
  ].join("\n");

  it("replaces the status column with the explored icon", () => {
    const updated = updateExplorationFile(parseExplorationFile(file), [route("/home", "ok")]);
    expect(updated).toContain("| /home | public | explored | ready |");
  });

  it("leaves routes without results untouched", () => {
    const updated = updateExplorationFile(parseExplorationFile(file), []);
    expect(updated).toBe(file);
  });
});

describe("explore appendFailureSection", () => {
  const base = "# App Exploration\n\n| /home | public | explored | ready |\n";

  it("appends a failure table for error and auth-required routes", () => {
    const out = appendFailureSection(base, [
      route("/broken", "error"),
      route("/private", "auth-required"),
    ]);
    expect(out).toContain("## Exploration Failures");
    expect(out).toContain("| /broken | error |");
    expect(out).toContain("Requires authentication — set up auth.setup.ts");
  });

  it("replaces an existing failure section on re-run instead of duplicating it", () => {
    const withSection = base + "\n## Exploration Failures\n\n| /old | error | x |  |\n";
    const out = appendFailureSection(withSection, [route("/new", "error")]);
    expect(out.match(/## Exploration Failures/g)).toHaveLength(1);
    expect(out).toContain("/new");
    expect(out).not.toContain("/old");
  });

  it("removes the section entirely when there are no failures and trims trailing blanks", () => {
    const withSection = base + "\n## Exploration Failures\n\n| /old | error | x |  |\n\n";
    const out = appendFailureSection(withSection, [route("/home", "ok")]);
    expect(out).not.toContain("## Exploration Failures");
    expect(out.endsWith("\n")).toBe(true);
    expect(out.trimEnd()).not.toMatch(/\n\n+$/);
  });
});
