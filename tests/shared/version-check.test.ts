import { describe, it, expect } from "vitest";

// ─── compareVersions logic ─────────────────────────────────────────────────

describe("version comparison logic", () => {
  function compareVersions(a: string, b: string): number {
    const pa = a.replace(/^v/, "").split(".").map(Number);
    const pb = b.replace(/^v/, "").split(".").map(Number);
    for (let i = 0; i < 3; i++) {
      if ((pa[i] ?? 0) > (pb[i] ?? 0)) return 1;
      if ((pa[i] ?? 0) < (pb[i] ?? 0)) return -1;
    }
    return 0;
  }

  it("detects newer version", () => {
    expect(compareVersions("0.3.35", "0.3.34")).toBe(1);
    expect(compareVersions("1.0.0", "0.3.34")).toBe(1);
    expect(compareVersions("0.4.0", "0.3.34")).toBe(1);
  });

  it("detects same version", () => {
    expect(compareVersions("0.3.34", "0.3.34")).toBe(0);
  });

  it("detects older version", () => {
    expect(compareVersions("0.3.33", "0.3.34")).toBe(-1);
    expect(compareVersions("0.2.0", "0.3.34")).toBe(-1);
  });

  it("handles v prefix", () => {
    expect(compareVersions("v0.3.34", "0.3.34")).toBe(0);
    expect(compareVersions("0.3.35", "v0.3.34")).toBe(1);
  });

  it("handles missing patch/minor", () => {
    expect(compareVersions("1.0", "1.0.0")).toBe(0);
    expect(compareVersions("2", "1.0.0")).toBe(1);
  });
});
