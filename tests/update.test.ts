import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// ─── syncSkillTemplates ────────────────────────────────────────────────────────

describe("syncSkillTemplates", () => {
  const tmpDir = join(tmpdir(), "openspec-pw-update-test-" + Date.now());

  beforeEach(() => {
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("skips when .claude does not exist in project", async () => {
    const { syncSkillTemplates } = await import("../../src/commands/update.js");
    // Should not throw
    syncSkillTemplates(tmpDir, join(tmpdir(), "nonexistent-project-xyz"));
  });

  it("creates templates directory in project .claude/skills/openspec-e2e", async () => {
    const projectDir = join(tmpdir(), "sync-skill-templates-project-" + Date.now());
    mkdirSync(join(projectDir, ".claude", "skills", "openspec-e2e"), { recursive: true });

    // Create source templates
    const srcTemplates = join(tmpDir, "templates");
    mkdirSync(srcTemplates, { recursive: true });
    writeFileSync(join(srcTemplates, "app-exploration.md"), "# Exploration");
    writeFileSync(join(srcTemplates, "test-plan.md"), "# Test Plan");

    const { syncSkillTemplates } = await import("../../src/commands/update.js");
    syncSkillTemplates(tmpDir, projectDir);

    expect(existsSync(join(projectDir, ".claude", "skills", "openspec-e2e", "templates", "app-exploration.md"))).toBe(true);
    expect(existsSync(join(projectDir, ".claude", "skills", "openspec-e2e", "templates", "test-plan.md"))).toBe(true);
    rmSync(projectDir, { recursive: true, force: true });
  });

  it("updates existing template files when content differs", async () => {
    const projectDir = join(tmpdir(), "sync-skill-update-project-" + Date.now());
    mkdirSync(join(projectDir, ".claude", "skills", "openspec-e2e", "templates"), { recursive: true });
    writeFileSync(join(projectDir, ".claude", "skills", "openspec-e2e", "templates", "app-exploration.md"), "old content");

    const srcTemplates = join(tmpDir, "templates");
    mkdirSync(srcTemplates, { recursive: true });
    writeFileSync(join(srcTemplates, "app-exploration.md"), "new content");

    const { syncSkillTemplates } = await import("../../src/commands/update.js");
    syncSkillTemplates(tmpDir, projectDir);

    expect(readFileSync(join(projectDir, ".claude", "skills", "openspec-e2e", "templates", "app-exploration.md"), "utf-8")).toBe("new content");
    rmSync(projectDir, { recursive: true, force: true });
  });

  it("does not update when content is identical", async () => {
    const projectDir = join(tmpdir(), "sync-skill-identical-project-" + Date.now());
    mkdirSync(join(projectDir, ".claude", "skills", "openspec-e2e", "templates"), { recursive: true });
    const sameContent = "same content";
    writeFileSync(join(projectDir, ".claude", "skills", "openspec-e2e", "templates", "app-exploration.md"), sameContent);

    const srcTemplates = join(tmpDir, "templates");
    mkdirSync(srcTemplates, { recursive: true });
    writeFileSync(join(srcTemplates, "app-exploration.md"), sameContent);

    const { syncSkillTemplates } = await import("../../src/commands/update.js");
    syncSkillTemplates(tmpDir, projectDir);

    // File should still exist with same content
    expect(readFileSync(join(projectDir, ".claude", "skills", "openspec-e2e", "templates", "app-exploration.md"), "utf-8")).toBe(sameContent);
    rmSync(projectDir, { recursive: true, force: true });
  });
});

// ─── syncCredentials ──────────────────────────────────────────────────────────

describe("syncCredentials", () => {
  const tmpDir = join(tmpdir(), "openspec-pw-credentials-test-" + Date.now());

  beforeEach(() => {
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("skips when source template does not exist", async () => {
    const { syncCredentials } = await import("../../src/commands/update.js");
    // Should not throw
    syncCredentials(tmpDir, join(tmpdir(), "some-project"));
  });

  it("generates credentials.yaml when destination does not exist", async () => {
    const projectDir = join(tmpdir(), "creds-gen-project-" + Date.now());
    const src = join(tmpDir, "templates");
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, "credentials.yaml"), "api: http://localhost\nusers: []");

    const { syncCredentials } = await import("../../src/commands/update.js");
    syncCredentials(tmpDir, projectDir);

    expect(existsSync(join(projectDir, "tests", "playwright", "credentials.yaml"))).toBe(true);
    rmSync(projectDir, { recursive: true, force: true });
  });

  it("preserves user credentials when updating existing file", async () => {
    const projectDir = join(tmpdir(), "creds-preserve-project-" + Date.now());
    mkdirSync(join(projectDir, "tests", "playwright"), { recursive: true });

    // Existing credentials with user data
    const existingCreds = `api: http://localhost:3000
users:
  - name: admin
    username: admin@test.com
    password: secret123
`;
    writeFileSync(join(projectDir, "tests", "playwright", "credentials.yaml"), existingCreds);

    // New template - must include `# Multi-user` comment for replace pattern
    const src = join(tmpDir, "templates");
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, "credentials.yaml"), `api: CHANGE_ME
# Multi-user test credentials
users:
  - name: CHANGE_ME
    username: CHANGE_ME
    password: CHANGE_ME

  # Multi-user example (uncomment for role-based tests)
`);

    const { syncCredentials } = await import("../../src/commands/update.js");
    syncCredentials(tmpDir, projectDir);

    const updated = readFileSync(join(projectDir, "tests", "playwright", "credentials.yaml"), "utf-8");
    expect(updated).toContain("http://localhost:3000"); // preserved api
    expect(updated).toContain("admin@test.com"); // preserved user
    expect(updated).toContain("secret123"); // preserved password
    rmSync(projectDir, { recursive: true, force: true });
  });

  it("creates backup of existing credentials before update", async () => {
    const projectDir = join(tmpdir(), "creds-backup-project-" + Date.now());
    mkdirSync(join(projectDir, "tests", "playwright"), { recursive: true });

    const existingCreds = `api: http://localhost:3000
users:
  - name: admin
    username: admin@test.com
    password: secret123
`;
    writeFileSync(join(projectDir, "tests", "playwright", "credentials.yaml"), existingCreds);

    const src = join(tmpDir, "templates");
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, "credentials.yaml"), `api: NEW_API
users:
  - name: NEW_USER
    username: new@test.com
    password: newpass

  # Multi-user example
`);

    const { syncCredentials } = await import("../../src/commands/update.js");
    syncCredentials(tmpDir, projectDir);

    // Backup should exist with original content
    expect(existsSync(join(projectDir, "tests", "playwright", "credentials.yaml.bak"))).toBe(true);
    expect(readFileSync(join(projectDir, "tests", "playwright", "credentials.yaml.bak"), "utf-8")).toBe(existingCreds);
    rmSync(projectDir, { recursive: true, force: true });
  });

  it("skips when credentials file already matches template", async () => {
    const projectDir = join(tmpdir(), "creds-identical-project-" + Date.now());
    mkdirSync(join(projectDir, "tests", "playwright"), { recursive: true });

    const templateContent = `api: CHANGE_ME
users:
  - name: CHANGE_ME
    username: CHANGE_ME
    password: CHANGE_ME
`;
    writeFileSync(join(projectDir, "tests", "playwright", "credentials.yaml"), templateContent);

    const src = join(tmpDir, "templates");
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, "credentials.yaml"), templateContent);

    const { syncCredentials } = await import("../../src/commands/update.js");
    syncCredentials(tmpDir, projectDir);

    // No backup should be created when content matches
    expect(existsSync(join(projectDir, "tests", "playwright", "credentials.yaml.bak"))).toBe(false);
    rmSync(projectDir, { recursive: true, force: true });
  });
});

// ─── User data extraction regex (testing the logic) ──────────────────────────

describe("credentials user extraction logic", () => {
  it("extracts users from yaml with multiple entries", () => {
    const yaml = `api: http://localhost
users:
  - name: admin
    username: admin@test.com
    password: secret123

  - name: user2
    username: user2@test.com
    password: pass456
`;
    // Same pattern as syncCredentials in update.ts
    const regex = /^  - name:\s*(\S+)\n    username:\s*(.+?)\n    password:\s*(.+?)(?:\n|$)/gm;
    const matches: { name: string; username: string; password: string }[] = [];
    let m;
    while ((m = regex.exec(yaml)) !== null) {
      matches.push({ name: m[1], username: m[2].trim(), password: m[3].trim() });
    }
    expect(matches).toHaveLength(2);
    expect(matches[0]).toEqual({ name: "admin", username: "admin@test.com", password: "secret123" });
    expect(matches[1]).toEqual({ name: "user2", username: "user2@test.com", password: "pass456" });
  });

  it("handles yaml with no users section", () => {
    const yaml = `api: http://localhost
other: value
`;
    const userBlockMatch = yaml.match(/^users:\n([\s\S]*?)(?=\n[^ ])/m);
    expect(userBlockMatch).toBeNull();
  });

  it("extracts api value from credentials yaml", () => {
    const yaml = `api: http://localhost:3000
users:
  - name: admin
    username: admin@test.com
    password: secret
`;
    const apiMatch = yaml.match(/^api:\s*(.+?)(?:\n|$)/m);
    expect(apiMatch).not.toBeNull();
    expect(apiMatch![1].trim()).toBe("http://localhost:3000");
  });

  it("handles yaml with api that contains CHANGE_ME placeholder", () => {
    const yaml = `api: CHANGE_ME
users:
  - name: test
    username: CHANGE_ME
    password: CHANGE_ME
`;
    const apiMatch = yaml.match(/^api:\s*(.+?)(?:\n|$)/m);
    expect(apiMatch![1].trim()).toBe("CHANGE_ME");
    expect(apiMatch![1].includes("CHANGE_ME")).toBe(true);
  });
});