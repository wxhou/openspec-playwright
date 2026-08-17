import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { getSitemapRoutes } from "../../src/commands/audit.js";

describe("audit getSitemapRoutes", () => {
  const tmpDir = join(tmpdir(), "ospw-pw-audit-" + Date.now());
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mkdirSync(tmpDir, { recursive: true });
    // Vitest runs under Vite, which injects process.env.BASE_URL="/". Isolate
    // the tests from it so detectAppServer's env branch is only driven by
    // what each test explicitly sets.
    vi.stubEnv("BASE_URL", "");
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        "<urlset><url><loc>http://localhost/</loc></url></urlset>",
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("uses BASE_URL env when set", async () => {
    vi.stubEnv("BASE_URL", "http://localhost:9999");
    await getSitemapRoutes(tmpDir);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:9999/sitemap.xml",
      expect.anything(),
    );
  });

  it("detects the app port when no env is set (vite → 5173)", async () => {
    writeFileSync(
      join(tmpDir, "package.json"),
      JSON.stringify({
        scripts: { dev: "vite" },
        devDependencies: { vite: "^8.0.0" },
      }),
    );
    await getSitemapRoutes(tmpDir);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:5173/sitemap.xml",
      expect.anything(),
    );
  });

  it("falls back to localhost:3000 when detection finds nothing", async () => {
    await getSitemapRoutes(tmpDir);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/sitemap.xml",
      expect.anything(),
    );
  });

  it("reports a non-OK sitemap response with its status", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, text: async () => "" });
    const result = await getSitemapRoutes(tmpDir);
    expect(result.routes).toEqual([]);
    expect(result.note).toContain("returned 404");
  });
});
