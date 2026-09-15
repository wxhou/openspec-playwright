import type { ExtraArtifact } from "./types.js";
export declare const VENDORED_AGENT_ROLES: readonly ["planner"];
export type VendoredAgentRole = (typeof VENDORED_AGENT_ROLES)[number];
/**
 * Roles we used to vendor and no longer ship. Their hashes live in
 * manifest.json historicalHashes so older installs' clean copies still
 * classify as tool-owned (removable on uninstall/deselect) — the paths are
 * derived from the manifest, never installed or refreshed.
 */
export declare const RETIRED_AGENT_ROLES: readonly ["generator", "healer"];
export type RetiredAgentRole = Exclude<(typeof RETIRED_AGENT_ROLES)[number], VendoredAgentRole>;
export type KnownAgentRole = VendoredAgentRole | RetiredAgentRole;
/** Project-relative install path for one vendored agent file. */
export declare function vendoredAgentRelPath(role: VendoredAgentRole): string;
export declare function vendoredAgentRelPaths(): string[];
/** Machine-readable snapshot manifest shipped next to the templates. */
export interface AgentsManifest {
    baseline: string;
    files: Record<VendoredAgentRole, string>;
    /** Snapshots of previous baselines — keep old installs refreshable. Also
     * carries retired roles' hashes (see RETIRED_AGENT_ROLES). */
    historicalHashes?: Partial<Record<KnownAgentRole, string[]>>;
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
/** Role for a vendored or retired agent rel path, or null when foreign. */
export declare function roleForRelPath(relPath: string): KnownAgentRole | null;
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
 * Includes retired roles: their on-disk files (if any) are classified via
 * the historical hash chain alone, so clean copies surface as owned
 * (removable) and edited copies as modified (never touched).
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
