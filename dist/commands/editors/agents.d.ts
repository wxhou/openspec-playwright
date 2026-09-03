import type { ExtraArtifact } from "./types.js";
export declare const VENDORED_AGENT_ROLES: readonly ["planner", "generator", "healer"];
export type VendoredAgentRole = (typeof VENDORED_AGENT_ROLES)[number];
/** Project-relative install path for one vendored agent file. */
export declare function vendoredAgentRelPath(role: VendoredAgentRole): string;
export declare function vendoredAgentRelPaths(): string[];
/** Machine-readable snapshot manifest shipped next to the templates. */
export interface AgentsManifest {
    baseline: string;
    files: Record<VendoredAgentRole, string>;
    /** Snapshots of previous baselines — keep old installs refreshable. */
    historicalHashes?: Partial<Record<VendoredAgentRole, string[]>>;
}
/** Directory of the installed package's agents templates (dist-relative). */
export declare function installedAgentsSnapshotDir(): string;
export declare function readAgentsManifest(dir: string): AgentsManifest | null;
/** Current snapshot contents for all three roles; [] when templates are missing. */
export declare function loadAgentSnapshots(dir: string): ExtraArtifact[];
/**
 * Normalize CRLF to LF before content-based ownership decisions. Git's
 * autocrlf converts LF snapshots to CRLF in Windows working trees — the
 * byte compare must be insensitive to that or every Windows checkout gets
 * misclassified as user-owned.
 */
export declare function normalizeEol(content: string): string;
export declare function sha256Contents(content: string): string;
export type AgentFileState = "missing" | "owned" | "modified";
/** Role for a vendored agent rel path, or null when it is not one of ours. */
export declare function roleForRelPath(relPath: string): VendoredAgentRole | null;
/**
 * Classify one installed agent file against a snapshot set: missing on disk,
 * tool-owned (hash matches the current or any historical snapshot), or
 * user-owned (everything else). Pure given the inputs — no logging.
 */
export declare function classifyAgentFile(projectRoot: string, relPath: string, snapshotContents: string, manifest: AgentsManifest): AgentFileState;
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
export declare function enumerateVendoredAgents(projectRoot: string, dir: string): VendoredAgentsInventory;
/**
 * Update-phase sync of the vendored agent files from a freshly fetched npm
 * bundle (dir = <bundle>/templates/agents). Refresh-only territory: tool-
 * owned files drifting from the snapshot are rewritten; user-owned files are
 * skipped with a notice; missing files are never created (opt-in via init
 * --agents — a deleted agent file stays deleted). When claude is not
 * authorized but agent files exist, everything is reported and left alone.
 */
export declare function syncVendoredAgents(dir: string, projectRoot: string, claudeAuthorized: boolean): void;
