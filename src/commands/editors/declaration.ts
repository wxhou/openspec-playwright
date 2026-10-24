/**
 * Compiles a declarative `AdapterDeclaration` into the runtime
 * `EditorAdapter` surface. Keeping the runtime interface stable means every
 * consumer (registry, shared/mcp, init/update/doctor/uninstall) is untouched
 * by the contract refactor — only the declaration sites change.
 */
import { existsSync, readdirSync } from "fs";
import { homedir } from "os";
import { join, resolve as pathResolve } from "path";
import type {
  AdapterDeclaration,
  ArtifactRoot,
  ArtifactSpec,
  CommandMeta,
  DetectionSpec,
  EditorAdapter,
  ExtraArtifact,
  RulesSpec,
} from "./types.js";
import { formatArtifact } from "./shared.js";
import { buildMcpRuntime, writeOpenCodeInstructions } from "./mcp-carriers.js";

// ─── Detection tiers ─────────────────────────────────────────────────────

function anyPathExists(root: string, paths: string[] | undefined): boolean {
  return (paths ?? []).some((p) => existsSync(pathResolve(root, p)));
}

/** True when a tool-owned artifact namespace exists under one of the roots. */
export function artifactRootHit(
  root: string,
  roots: ArtifactRoot[] | undefined,
): boolean {
  for (const spec of roots ?? []) {
    const dir = pathResolve(root, spec.dir);
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    const hit = entries.some(
      (entry) =>
        entry.isDirectory() &&
        entry.name.startsWith(spec.prefix) &&
        (!spec.entry || existsSync(join(dir, entry.name, spec.entry))),
    );
    if (hit) return true;
  }
  return false;
}

/** Project-level signal: marker paths or tool-owned artifacts. */
export function projectSignalFor(
  root: string,
  detection: DetectionSpec,
): boolean {
  return (
    anyPathExists(root, detection.projectPaths) ||
    artifactRootHit(root, detection.artifactRoots)
  );
}

/** Interactive first-run pre-select: project signals plus intent files. */
export function preselectSignalFor(
  root: string,
  detection: DetectionSpec,
): boolean {
  return (
    projectSignalFor(root, detection) ||
    anyPathExists(root, detection.intentPaths)
  );
}

// ─── Compiler ────────────────────────────────────────────────────────────

const defaultRulesPath = (root: string) => join(root, "AGENTS.md");

function compileRules(rules: RulesSpec | undefined) {
  const rulesPath = rules?.path ?? defaultRulesPath;
  const registerInstructions =
    rules?.registerInConfig === "opencode-json"
      ? (root: string, instructions: string[]) =>
          writeOpenCodeInstructions(root, instructions)
      : undefined;
  return { rulesPath, registerInstructions };
}

function compileExtraArtifacts(
  secondary: ArtifactSpec[],
): ((meta: CommandMeta) => ExtraArtifact[]) | undefined {
  if (secondary.length === 0) return undefined;
  return (meta) =>
    secondary.map((spec) => ({
      relativePath: spec.path(meta.id),
      contents: formatArtifact(spec, meta),
    }));
}

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
export function defineAdapter(decl: AdapterDeclaration): EditorAdapter {
  const [primary, ...secondary] = decl.artifacts;
  if (!primary) {
    throw new Error(`adapter "${decl.id}" declares no artifacts`);
  }
  const mcp = buildMcpRuntime(decl.mcp);
  const { rulesPath, registerInstructions } = compileRules(decl.rules);

  const projectSignal = (root: string) =>
    projectSignalFor(root, decl.detection);

  return {
    id: decl.id,
    label: decl.label,
    displayName: decl.displayName,
    detect(root, homeDir) {
      return (
        projectSignal(root) ||
        anyPathExists(homeDir ?? homedir(), decl.detection.globalPaths)
      );
    },
    projectSignal,
    supportsMcp: mcp.supportsMcp,
    commandFilePath: primary.path,
    commandForm: primary.naming === "namespace-dir" ? "colon" : "hyphen",
    formatCommand: (meta) => formatArtifact(primary, meta),
    projectRulesPath: rulesPath,
    isMcpInstalled: mcp.isMcpInstalled,
    installMcp: mcp.installMcp,
    removeMcp: mcp.removeMcp,
    mcpConfigPath: mcp.mcpConfigPath,
    registerInstructions,
    extraArtifacts: compileExtraArtifacts(secondary),
    optionalArtifacts: decl.optionalArtifacts,
    declaration: decl,
  };
}
