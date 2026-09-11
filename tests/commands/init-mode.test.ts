import { describe, it, expect } from "vitest";
import { resolveInitMode } from "../../src/commands/init.js";

describe("resolveInitMode", () => {
  it("frontend signal true → frontend mode", () => {
    expect(resolveInitMode({}, true)).toBe("frontend");
  });

  it("frontend signal false → minimal mode", () => {
    expect(resolveInitMode({}, false)).toBe("minimal");
  });

  it("frontend signal null (no readable package.json) → minimal mode", () => {
    expect(resolveInitMode({}, null)).toBe("minimal");
  });

  it("--frontend forces frontend mode even on a missed signal", () => {
    expect(resolveInitMode({ frontend: true }, false)).toBe("frontend");
    expect(resolveInitMode({ frontend: true }, null)).toBe("frontend");
  });

  it("--no-frontend forces minimal mode even on a hit", () => {
    expect(resolveInitMode({ frontend: false }, true)).toBe("minimal");
  });
});