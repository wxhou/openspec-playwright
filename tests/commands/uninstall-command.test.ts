import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

// Keep real shared exports, stub only detectCodeGraphStatus so the
// CodeGraph cleanup note is controllable without touching the real CLI.
vi.mock("../../src/shared/index.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/shared/index.js")>();
  return { ...actual, detectCodeGraphStatus: vi.fn() };
});

// Keep real editors exports, stub detectAdapters so uninstall only sees
// the adapters this test controls (no real ~/.claude.json etc).
vi.mock("../../src/commands/editors.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/commands/editors.js")>();
  return { ...actual, detectAdapters: vi.fn() };
});

import { detectCodeGraphStatus } from "../../src/shared/index.js";
import { detectAdapters, cursorAdapter } from "../../src/commands/editors.js";
import { uninstall } from "../../src/commands/uninstall.js";

const mockedDetectCodeGraphStatus = vi.mocked(detectCodeGraphStatus);
const mockedDetectAdapters = vi.mocked(detectAdapters);

let tmp: string;
let cwd: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "ospw-uninstall-"));
  cwd = process.cwd();
  process.chdir(tmp);
  mockedDetectCodeGraphStatus.mockReset();
  mockedDetectAdapters.mockReset();
});

afterEach(() => {
  process.chdir(cwd);
  rmSync(tmp, { recursive: true, force: true });
});

describe("uninstall() CodeGraph cleanup note", () => {
  it("prints codegraph uninstall note when the MCP is installed", async () => {
    mockedDetectAdapters.mockReturnValue([cursorAdapter]);
    mockedDetectCodeGraphStatus.mockReturnValue({
      cliInstalled: true,
      indexed: true,
      mcpInstalledAdapters: ["cursor"],
    });

    const spy = vi.spyOn(console, "log");
    await uninstall();
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("codegraph uninstall"),
    );
    spy.mockRestore();
  });

  it("prints no codegraph note when the MCP is not installed", async () => {
    mockedDetectAdapters.mockReturnValue([cursorAdapter]);
    mockedDetectCodeGraphStatus.mockReturnValue({
      cliInstalled: true,
      indexed: true,
      mcpInstalledAdapters: [],
    });

    const spy = vi.spyOn(console, "log");
    await uninstall();
    expect(spy).not.toHaveBeenCalledWith(
      expect.stringContaining("codegraph uninstall"),
    );
    spy.mockRestore();
  });
});