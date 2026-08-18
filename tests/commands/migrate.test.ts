import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock fs modules used by migrate.ts
vi.mock("fs", () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  mkdirSync: vi.fn(),
  renameSync: vi.fn(),
}));

import { existsSync, readdirSync, mkdirSync, renameSync } from "fs";
import { migrate } from "../../src/commands/migrate.js";

const existsSyncMock = vi.mocked(existsSync);
const readdirSyncMock = vi.mocked(readdirSync);
const mkdirSyncMock = vi.mocked(mkdirSync);
const renameSyncMock = vi.mocked(renameSync);

describe("migrate", () => {
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  const root = "/tmp/fake-project";

  beforeEach(() => {
    vi.clearAllMocks();
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(root);
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    cwdSpy.mockRestore();
    logSpy.mockRestore();
  });

  it("prints yellow message and returns when tests/playwright/ is missing", async () => {
    existsSyncMock.mockReturnValue(false);

    await migrate({});

    expect(existsSyncMock).toHaveBeenCalledWith(`${root}/tests/playwright`);
    expect(readdirSyncMock).not.toHaveBeenCalled();
    expect(renameSyncMock).not.toHaveBeenCalled();
    expect(mkdirSyncMock).not.toHaveBeenCalled();

    const messages = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(messages).toContain("tests/playwright/ not found");
  });

  it("prints Nothing-to-migrate message when no old files remain", async () => {
    // First existsSync → tests/playwright exists; subsequent per-item calls return false
    existsSyncMock.mockImplementation((p) =>
      String(p) === `${root}/tests/playwright`,
    );
    readdirSyncMock.mockReturnValue([
      "seed.spec.ts",
      "auth.setup.ts",
      "credentials.yaml",
    ] as unknown as string[]);

    await migrate({});

    expect(readdirSyncMock).toHaveBeenCalledWith(`${root}/tests/playwright`);
    expect(renameSyncMock).not.toHaveBeenCalled();

    const messages = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(messages).toContain("No old-style change spec files found");
  });

  it("migrates a single old spec file into changes/<name>/", async () => {
    // tests/playwright dir + oldPath exist; newPath does not (default mock)
    existsSyncMock.mockImplementation((p) => {
      const path = String(p);
      if (path === `${root}/tests/playwright`) return true;
      if (path === `${root}/tests/playwright/my-change.spec.ts`) return true;
      return false;
    });
    readdirSyncMock.mockReturnValue(["my-change.spec.ts"] as unknown as string[]);

    await migrate({});

    // changes/ and changes/my-change/ created recursively
    expect(mkdirSyncMock).toHaveBeenCalledWith(
      `${root}/tests/playwright/changes`,
      { recursive: true },
    );
    expect(mkdirSyncMock).toHaveBeenCalledWith(
      `${root}/tests/playwright/changes/my-change`,
      { recursive: true },
    );
    expect(renameSyncMock).toHaveBeenCalledTimes(1);
    expect(renameSyncMock).toHaveBeenCalledWith(
      `${root}/tests/playwright/my-change.spec.ts`,
      `${root}/tests/playwright/changes/my-change/my-change.spec.ts`,
    );
  });

  it("--dry-run plans but does not move files", async () => {
    existsSyncMock.mockReturnValue(true);
    readdirSyncMock.mockReturnValue(["foo.spec.ts"] as unknown as string[]);

    await migrate({ dryRun: true });

    expect(renameSyncMock).not.toHaveBeenCalled();
    expect(mkdirSyncMock).not.toHaveBeenCalled();

    const messages = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(messages).toContain("Dry run");
    expect(messages).toContain("would succeed");
  });

  it("skips migration when target exists and --force is not set", async () => {
    existsSyncMock.mockImplementation((p) => {
      const path = String(p);
      // tests/playwright dir exists
      if (path === `${root}/tests/playwright`) return true;
      // old file exists
      if (path === `${root}/tests/playwright/foo.spec.ts`) return true;
      // target also exists → conflict
      if (path === `${root}/tests/playwright/changes/foo/foo.spec.ts`) return true;
      return false;
    });
    readdirSyncMock.mockReturnValue(["foo.spec.ts"] as unknown as string[]);

    await migrate({});

    expect(renameSyncMock).not.toHaveBeenCalled();

    const messages = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(messages).toContain("already exists");
    expect(messages).toContain("--force");
  });

  it("overwrites target when --force is set", async () => {
    existsSyncMock.mockImplementation((p) => {
      const path = String(p);
      if (path === `${root}/tests/playwright`) return true;
      if (path === `${root}/tests/playwright/foo.spec.ts`) return true;
      if (path === `${root}/tests/playwright/changes/foo/foo.spec.ts`) return true;
      return false;
    });
    readdirSyncMock.mockReturnValue(["foo.spec.ts"] as unknown as string[]);

    await migrate({ force: true });

    expect(renameSyncMock).toHaveBeenCalledTimes(1);
    expect(renameSyncMock).toHaveBeenCalledWith(
      `${root}/tests/playwright/foo.spec.ts`,
      `${root}/tests/playwright/changes/foo/foo.spec.ts`,
    );
  });

  it("skips when readdirSync returns a file but oldPath no longer exists (TOCTOU)", async () => {
    // TOCTOU: readdirSync saw the file, but existsSync reports it gone.
    existsSyncMock.mockImplementation((p) => {
      const path = String(p);
      // tests/playwright dir itself exists
      if (path === `${root}/tests/playwright`) return true;
      // oldPath is gone — simulate file deletion between readdirSync and existsSync
      return false;
    });
    readdirSyncMock.mockReturnValue(["ghost.spec.ts"] as unknown as string[]);

    await migrate({});

    expect(renameSyncMock).not.toHaveBeenCalled();
    // Only the top-level changes/ mkdirSync runs; per-item one is gated by the skip branch.
    expect(mkdirSyncMock).toHaveBeenCalledTimes(1);

    const messages = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(messages).toContain("not found, skipping");
  });
});
