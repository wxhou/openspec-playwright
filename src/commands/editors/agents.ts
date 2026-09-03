/**
 * Vendored Playwright agent artifacts — claude only, opt-in via `init
 * --agents`. The three files are byte-identical snapshots of the official
 * `playwright init-agents --loop claude` output; provenance and the refresh
 * SOP live in templates/agents/SOURCE.md, the machine-readable snapshot
 * manifest in templates/agents/manifest.json.
 *
 * Ownership is content-based (template snapshot = the manifest's current +
 * historical hashes): a file hashing to any known snapshot is tool-owned;
 * anything else is user-owned (manual edit, or output of a newer official
 * init-agents run) and is never silently overwritten or deleted. Historical
 * hashes are what keep "package snapshot moved ahead" refreshable — without
 * them an old-snapshot file would be indistinguishable from a user edit and
 * frozen forever.
 *
 * These artifacts deliberately stay OUT of listCommandArtifactPaths: they
 * never confer configured status, pre-selection, or write authorization.
 * Removal happens only through the agents-aware primitives in removal.ts,
 * called from init's deselection flow and uninstall.
 */
import { createHash } from "crypto";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import chalk from "chalk";
import type { ExtraArtifact } from "./types.js";

export const VENDORED_AGENT_ROLES = ["planner", "generator", "healer"] as const;
export type VendoredAgentRole = (typeof VENDORED_AGENT_ROLES)[number];

/** Project-relative install path for one vendored agent file. */
export function vendoredAgentRelPath(role: VendoredAgentRole): string {
  return join(".claude", "agents", `playwright-test-${role}.md`);
}

export function vendoredAgentRelPaths(): string[] {
  return VENDORED_AGENT_ROLES.map(vendoredAgentRelPath);
}

/** Machine-readable snapshot manifest shipped next to the templates. */
export interface AgentsManifest {
  baseline: string;
  files: Record<VendoredAgentRole, string>;
  /** Snapshots of previous baselines — keep old installs refreshable. */
  historicalHashes?: Partial<Record<VendoredAgentRole, string[]>>;
}

/** Directory of the installed package's agents templates (dist-relative). */
export function installedAgentsSnapshotDir(): string {
  return fileURLToPath(new URL("../../../templates/agents", import.meta.url));
}

export function readAgentsManifest(dir: string): AgentsManifest | null {
  try {
    return JSON.parse(readFileSync(join(dir, "manifest.json"), "utf-8"));
  } catch {
    return null;
  }
}

/** Current snapshot contents for all three roles; [] when templates are missing. */
export function loadAgentSnapshots(dir: string): ExtraArtifact[] {
  const manifest = readAgentsManifest(dir);
  if (!manifest) return [];
  const snapshots: ExtraArtifact[] = [];
  for (const role of VENDORED_AGENT_ROLES) {
    const abs = join(dir, "claude", `playwright-test-${role}.md`);
    if (!existsSync(abs)) continue;
    snapshots.push({ relativePath: vendoredAgentRelPath(role), contents: readFileSync(abs, "utf-8") });
  }
  return snapshots;
}

/**
 * Normalize CRLF to LF before content-based ownership decisions. Git's
 * autocrlf converts LF snapshots to CRLF in Windows working trees — the
 * byte compare must be insensitive to that or every Windows checkout gets
 * misclassified as user-owned.
 */
export function normalizeEol(content: string): string {
  return content.replace(/\r\n/g, "\n");
}

export function sha256Contents(content: string): string {
  return createHash("sha256").update(normalizeEol(content)).digest("hex");
}

export type AgentFileState = "missing" | "owned" | "modified";

/** Role for a vendored agent rel path, or null when it is not one of ours. */
export function roleForRelPath(relPath: string): VendoredAgentRole | null {
  for (const role of VENDORED_AGENT_ROLES) {
    if (relPath === vendoredAgentRelPath(role)) return role;
  }
  return null;
}

/**
 * Classify one installed agent file against a snapshot set: missing on disk,
 * tool-owned (hash matches the current or any historical snapshot), or
 * user-owned (everything else). Pure given the inputs — no logging.
 */
export function classifyAgentFile(
  projectRoot: string,
  relPath: string,
  snapshotContents: string,
  manifest: AgentsManifest,
): AgentFileState {
  const abs = join(projectRoot, relPath);
  if (!existsSync(abs)) return "missing";
  const existing = readFileSync(abs, "utf-8");
  if (normalizeEol(existing) === normalizeEol(snapshotContents)) return "owned";
  const role = roleForRelPath(relPath);
  if (!role) return "modified";
  if (manifest.historicalHashes?.[role]?.includes(sha256Contents(existing))) {
    return "owned";
  }
  return "modified";
}

export interface VendoredAgentsInventory {
  /** Tool-owned files present on disk (safe to refresh/remove). */
  owned: string[];
  /** Files present but differing from every known snapshot (never touched). */
  modified: string[];
  /** Roles not installed. */
  missing: string[];
}

/**
 * Enumerate the vendored agent files one project has, classified by
 * ownership. Read-only and silent — safe for confirm-list building.
 */
export function enumerateVendoredAgents(
  projectRoot: string,
  dir: string,
): VendoredAgentsInventory {
  const inventory: VendoredAgentsInventory = { owned: [], modified: [], missing: [] };
  const manifest = readAgentsManifest(dir);
  if (!manifest) return inventory;
  for (const snapshot of loadAgentSnapshots(dir)) {
    const state = classifyAgentFile(projectRoot, snapshot.relativePath, snapshot.contents, manifest);
    inventory[state].push(snapshot.relativePath);
  }
  return inventory;
}

/**
 * Update-phase sync of the vendored agent files from a freshly fetched npm
 * bundle (dir = <bundle>/templates/agents). Refresh-only territory: tool-
 * owned files drifting from the snapshot are rewritten; user-owned files are
 * skipped with a notice; missing files are never created (opt-in via init
 * --agents — a deleted agent file stays deleted). When claude is not
 * authorized but agent files exist, everything is reported and left alone.
 */
export function syncVendoredAgents(
  dir: string,
  projectRoot: string,
  claudeAuthorized: boolean,
): void {
  const manifest = readAgentsManifest(dir);
  if (!manifest) return;
  const inventory = enumerateVendoredAgents(projectRoot, dir);
  const present = inventory.owned.length + inventory.modified.length;
  if (present === 0) return;
  if (!claudeAuthorized) {
    console.log(
      chalk.gray(
        "  - claude: not configured in this project — vendored agents left untouched",
      ),
    );
    return;
  }
  for (const snapshot of loadAgentSnapshots(dir)) {
    const role = roleForRelPath(snapshot.relativePath);
    const abs = join(projectRoot, snapshot.relativePath);
    // Refresh only tool-owned files whose content differs from the snapshot
    // (old baselines stay refreshable via the manifest's historical hashes).
    const stale = classifyAgentFile(projectRoot, snapshot.relativePath, snapshot.contents, manifest) === "owned" && normalizeEol(readFileSync(abs, "utf-8")) !== normalizeEol(snapshot.contents);
    if (!stale) continue;
    writeFileSync(abs, snapshot.contents);
    console.log(chalk.green(`  ✓ ${role}: ${snapshot.relativePath} updated to snapshot ${manifest.baseline}`));
  }
  for (const relPath of inventory.modified) {
    console.log(
      chalk.yellow(
        `  ⚠ claude: ${relPath} differs from the bundled snapshot (manual edit or newer init-agents output) — left untouched`,
      ),
    );
  }
  if (inventory.missing.length > 0) {
    console.log(
      chalk.gray(
        `  - claude: ${inventory.owned.length + inventory.modified.length}/${VENDORED_AGENT_ROLES.length} vendored agents installed (missing are opt-in: openspec-pw init --agents)`,
      ),
    );
  }
}
