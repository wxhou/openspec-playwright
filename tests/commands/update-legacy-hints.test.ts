import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "fs";
import { join } from "path";
import { tmpdir } from "os";

// The CLI probe is overridden per test; the real classification is the default.
vi.mock("../../src/shared/openspec-version.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/shared/openspec-version.js")>();
  return { ...actual, openSpecCliStatus: vi.fn(actual.openSpecCliStatus) };
});

const OLDEST_SEED_HINT = "Then re-run /opsx:e2e.";
const LEGACY_SEED_HINT =
  "Then re-run the E2E workflow command (/opsx:e2e or /opsx-e2e depending on your editor).";
const CURRENT_SEED_HINT =
  "Then re-run the E2E workflow command for your editor.";
const LEGACY_CONFIG_COMMENT =
  "// Setup project (used by /opsx:e2e Healer and local auth setup)";
const CURRENT_CONFIG_COMMENT =
  "// Setup project (used by the E2E Healer and local auth setup)";

// A chmod-based read-only fixture only blocks writes for a non-root POSIX user.
const canMakeReadOnly = process.platform !== "win32" && process.getuid?.() !== 0;

describe("syncProjectTemplates: legacy command names", () => {
  let bundleDir: string;
  let projectDir: string;
  let testsDir: string;
  let logs: string[];
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    bundleDir = mkdtempSync(join(tmpdir(), "ospw-legacy-bundle-"));
    projectDir = mkdtempSync(join(tmpdir(), "ospw-legacy-project-"));
    testsDir = join(projectDir, "tests", "playwright");
    mkdirSync(join(bundleDir, "templates"), { recursive: true });
    mkdirSync(testsDir, { recursive: true });
    writeFileSync(
      join(bundleDir, "templates", "seed.spec.ts"),
      readFileSync(join(process.cwd(), "templates", "seed.spec.ts"), "utf-8"),
    );
    logs = [];
    logSpy = vi.spyOn(console, "log").mockImplementation((...args) => {
      logs.push(args.join(" "));
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
    rmSync(bundleDir, { recursive: true, force: true });
    rmSync(projectDir, { recursive: true, force: true });
  });

  async function sync() {
    const { syncProjectTemplates } = await import(
      "../../src/commands/update.js"
    );
    syncProjectTemplates(bundleDir, projectDir);
  }

  it("replaces the legacy auth hint and keeps user additions", async () => {
    const seedPath = join(testsDir, "seed.spec.ts");
    writeFileSync(
      seedPath,
      [
        "test('env', () => {",
        `  throw new Error(\`${LEGACY_SEED_HINT}\`);`,
        "});",
        "// my custom case",
      ].join("\n"),
    );

    await sync();

    const seed = readFileSync(seedPath, "utf-8");
    expect(seed).toContain(CURRENT_SEED_HINT);
    expect(seed).not.toContain("/opsx");
    expect(seed).toContain("// my custom case");
    expect(logs.join("\n")).toContain(
      "✓ Migrated: tests/playwright/seed.spec.ts",
    );
  });

  it("migrates the legacy setup-project comment in playwright.config.ts", async () => {
    const configPath = join(projectDir, "playwright.config.ts");
    writeFileSync(
      configPath,
      [LEGACY_CONFIG_COMMENT, "export default defineConfig({});", ""].join("\n"),
    );

    await sync();

    const config = readFileSync(configPath, "utf-8");
    expect(config).toContain(CURRENT_CONFIG_COMMENT);
    expect(config).not.toContain("/opsx");
    expect(config).toContain("export default defineConfig({});");
    expect(logs.join("\n")).toContain("✓ Migrated: playwright.config.ts");
  });

  it("is idempotent: a second run writes nothing and logs no migration", async () => {
    const seedPath = join(testsDir, "seed.spec.ts");
    writeFileSync(seedPath, `throw new Error(\`${LEGACY_SEED_HINT}\`);\n`);

    await sync();
    const afterFirst = readFileSync(seedPath, "utf-8");
    logs.length = 0;

    await sync();

    expect(readFileSync(seedPath, "utf-8")).toBe(afterFirst);
    expect(logs.join("\n")).not.toContain("Migrated");
  });

  it("leaves files without legacy text untouched and does not warn", async () => {
    const template = readFileSync(
      join(process.cwd(), "templates", "seed.spec.ts"),
      "utf-8",
    );
    const seedPath = join(testsDir, "seed.spec.ts");
    writeFileSync(seedPath, template);
    const configPath = join(projectDir, "playwright.config.ts");
    writeFileSync(configPath, "export default {};\n");
    writeFileSync(join(bundleDir, "templates", "test-plan.md"), "# plan\n");
    const seedBefore = readFileSync(seedPath, "utf-8");

    await sync();

    expect(readFileSync(seedPath, "utf-8")).toBe(seedBefore);
    expect(readFileSync(configPath, "utf-8")).toBe("export default {};\n");
    // The sync ran past both candidates: this later step wrote its file.
    expect(existsSync(join(testsDir, "test-plan.template.md"))).toBe(true);
    expect(logs.join("\n")).not.toContain("Migrated");
    expect(logs.join("\n")).not.toContain("differs from latest template");
  });

  it("migrates the oldest shipped seed wording", async () => {
    const seedPath = join(testsDir, "seed.spec.ts");
    writeFileSync(seedPath, `throw new Error(\`${OLDEST_SEED_HINT}\`);\n`);

    await sync();

    const seed = readFileSync(seedPath, "utf-8");
    expect(seed).toContain(CURRENT_SEED_HINT);
    expect(seed).not.toContain("/opsx");
  });

  it("migrates a JS-family config", async () => {
    const configPath = join(projectDir, "playwright.config.mjs");
    writeFileSync(configPath, `${LEGACY_CONFIG_COMMENT}\nexport default {};\n`);

    await sync();

    expect(readFileSync(configPath, "utf-8")).toContain(CURRENT_CONFIG_COMMENT);
  });

  it("migrates every config file that is present", async () => {
    writeFileSync(join(projectDir, "playwright.config.ts"), `${LEGACY_CONFIG_COMMENT}\n`);
    writeFileSync(join(projectDir, "playwright.config.js"), `${LEGACY_CONFIG_COMMENT}\n`);

    await sync();

    expect(logs.join("\n").match(/✓ Migrated: playwright\.config\./g)).toHaveLength(2);
  });

  it("migrates the removed openspec-pw run wording", async () => {
    const configPath = join(projectDir, "playwright.config.ts");
    writeFileSync(
      configPath,
      "// Setup project for authentication (configured by openspec-pw run)\nexport default {};\n",
    );

    await sync();

    expect(readFileSync(configPath, "utf-8")).toContain(CURRENT_CONFIG_COMMENT);
    expect(readFileSync(configPath, "utf-8")).not.toContain("openspec-pw run");
  });

  it.skipIf(process.platform === "win32")(
    "does not write through a symlinked config",
    async () => {
      const shared = join(projectDir, "shared.config.ts");
      writeFileSync(shared, `${LEGACY_CONFIG_COMMENT}\n`);
      symlinkSync(shared, join(projectDir, "playwright.config.ts"));

      await sync();

      expect(readFileSync(shared, "utf-8")).toBe(`${LEGACY_CONFIG_COMMENT}\n`);
      expect(logs.join("\n")).not.toContain("Migrated");
    },
  );

  it("migrates the config even when tests/playwright is absent", async () => {
    rmSync(testsDir, { recursive: true, force: true });
    const configPath = join(projectDir, "playwright.config.ts");
    writeFileSync(configPath, `${LEGACY_CONFIG_COMMENT}\n`);

    await sync();

    expect(readFileSync(configPath, "utf-8")).toContain(CURRENT_CONFIG_COMMENT);
  });

  it("current sentences match the shipped templates", () => {
    expect(
      readFileSync(join(process.cwd(), "templates", "seed.spec.ts"), "utf-8"),
    ).toContain(CURRENT_SEED_HINT);
    expect(
      readFileSync(
        join(process.cwd(), "templates", "playwright.config.ts"),
        "utf-8",
      ),
    ).toContain(CURRENT_CONFIG_COMMENT);
  });

  it.skipIf(!canMakeReadOnly)(
    "reports an unwritable file and keeps going",
    async () => {
      const seedPath = join(testsDir, "seed.spec.ts");
      writeFileSync(seedPath, `throw new Error(\`${LEGACY_SEED_HINT}\`);\n`);
      chmodSync(seedPath, 0o444);
      writeFileSync(join(bundleDir, "templates", "test-plan.md"), "# plan\n");
      try {
        await sync();
      } finally {
        chmodSync(seedPath, 0o644);
      }

      expect(readFileSync(seedPath, "utf-8")).toContain(LEGACY_SEED_HINT);
      expect(logs.join("\n")).toContain(
        "Could not migrate tests/playwright/seed.spec.ts",
      );
      // Later steps still run: the plan template was synced after the failure.
      expect(existsSync(join(testsDir, "test-plan.template.md"))).toBe(true);
    },
  );

  it("does not migrate when template syncing is skipped (--no-skill)", async () => {
    const seedPath = join(testsDir, "seed.spec.ts");
    writeFileSync(seedPath, `throw new Error(\`${LEGACY_SEED_HINT}\`);\n`);
    mkdirSync(join(projectDir, "openspec"), { recursive: true });
    const { openSpecCliStatus } = await import(
      "../../src/shared/openspec-version.js"
    );
    vi.mocked(openSpecCliStatus).mockReturnValue({ ok: true, major: 2 });
    const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(projectDir);
    try {
      const { update } = await import("../../src/commands/update.js");
      await update({ cli: false, skill: false, mcp: false });
    } finally {
      cwdSpy.mockRestore();
      vi.mocked(openSpecCliStatus).mockReset();
    }

    expect(readFileSync(seedPath, "utf-8")).toContain(LEGACY_SEED_HINT);
    expect(logs.join("\n")).not.toContain("Migrated");
  });
});
