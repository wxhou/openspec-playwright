import type { AdapterDeclaration, ArtifactRoot, DetectionSpec, EditorAdapter } from "./types.js";
/** True when a tool-owned artifact namespace exists under one of the roots. */
export declare function artifactRootHit(root: string, roots: ArtifactRoot[] | undefined): boolean;
/** Project-level signal: marker paths or tool-owned artifacts. */
export declare function projectSignalFor(root: string, detection: DetectionSpec): boolean;
/** Interactive first-run pre-select: project signals plus intent files. */
export declare function preselectSignalFor(root: string, detection: DetectionSpec): boolean;
/**
 * Build an `EditorAdapter` from a dimension-based declaration.
 *
 * Derived rules:
 *   - the first artifact is the primary command artifact;
 *   - `commandForm` and the body rewrite follow the artifact naming
 *     (`namespace-dir` → colon + unchanged, `hyphen-prefix` → hyphen + rewrite);
 *   - MCP methods, `supportsMcp` and `mcpConfigPath` come from the carrier;
 *   - detection tiers come from the detection spec (global paths never
 *     satisfy the project signal).
 */
export declare function defineAdapter(decl: AdapterDeclaration): EditorAdapter;
