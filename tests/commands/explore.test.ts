import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  parseExplorationFile,
  resolveExploreBaseUrl,
} from "../../src/commands/explore.js";

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
