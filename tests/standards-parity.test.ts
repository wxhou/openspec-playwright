import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (name: string) =>
  readFileSync(join(root, "standards", name), "utf-8");

interface SectionShape {
  bullets: number;
  red: number;
  yellow: number;
}

/** Per-section structure: bullet count plus marker counts. */
function shape(text: string): Map<string, SectionShape> {
  const result = new Map<string, SectionShape>();
  let current = "0";
  const ensure = () => {
    if (!result.has(current)) {
      result.set(current, { bullets: 0, red: 0, yellow: 0 });
    }
    return result.get(current)!;
  };
  for (const line of text.split("\n")) {
    const heading = line.match(/^## (\d+)\./);
    if (heading) {
      current = heading[1]!;
      ensure();
      continue;
    }
    if (!line.startsWith("- ")) continue;
    const entry = ensure();
    entry.bullets += 1;
    if (line.startsWith("- 🔴")) entry.red += 1;
    if (line.startsWith("- 🟡")) entry.yellow += 1;
  }
  return result;
}

// The ML pair is kept in lockstep by design; a change that lands in one
// language only is translation drift, not a smaller edit. The general pair is
// excluded because its §7 intentionally merges two bullets in Chinese that
// English keeps separate, so a strict count would fail on formatting alone.
describe("ML standards stay structurally identical across languages", () => {
  const zh = shape(read("employee-standards.ml.md"));
  const en = shape(read("employee-standards.ml.en.md"));

  it("covers the same sections", () => {
    expect([...en.keys()]).toEqual([...zh.keys()]);
  });

  it("carries the same number of bullets per section", () => {
    for (const [section, expected] of zh) {
      expect(en.get(section)?.bullets, `§${section}`).toBe(expected.bullets);
    }
  });

  it("carries the same number of 🔴 and 🟡 markers per section", () => {
    for (const [section, expected] of zh) {
      expect(en.get(section)?.red, `§${section} 🔴`).toBe(expected.red);
      expect(en.get(section)?.yellow, `§${section} 🟡`).toBe(expected.yellow);
    }
  });
});
