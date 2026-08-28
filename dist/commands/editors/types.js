/**
 * Core types and the `defineAdapter` factory for the editor adapter
 * layer. Zero internal dependencies — every other editors/* module may
 * import from this file.
 */
import { join } from "path";
/** Build the command metadata for the /opsx:e2e command. */
export function buildCommandMeta(body) {
    return {
        id: "e2e",
        name: "OPSX: E2E",
        description: "Run Playwright E2E verification for an OpenSpec change",
        category: "OpenSpec",
        tags: ["openspec", "playwright", "e2e", "testing"],
        body,
    };
}
const noop = () => { };
const alwaysFalse = () => false;
// Sentinel home dir that never exists — scopes detect() to project-level
// signals for adapters that don't declare their own projectSignal (the
// home-blind adapters ignore homeDir entirely).
export const NO_HOME = "\0openspec-pw-no-home";
/**
 * Build an `EditorAdapter` from a partial init object. Fills in
 * defaults so each adapter only declares what's actually different.
 */
export function defineAdapter(init) {
    return {
        id: init.id,
        label: init.label,
        displayName: init.displayName,
        detect: init.detect,
        projectSignal: init.projectSignal ?? ((root) => init.detect(root, NO_HOME)),
        commandFilePath: init.commandFilePath,
        formatCommand: init.formatCommand,
        supportsMcp: init.supportsMcp ?? true,
        projectRulesPath: init.projectRulesPath ?? ((root) => join(root, "AGENTS.md")),
        isMcpInstalled: init.isMcpInstalled ?? alwaysFalse,
        installMcp: init.installMcp ?? noop,
        removeMcp: init.removeMcp ?? noop,
        registerInstructions: init.registerInstructions,
        extraArtifacts: init.extraArtifacts,
    };
}
//# sourceMappingURL=types.js.map