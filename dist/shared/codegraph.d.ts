/**
 * Shared CodeGraph detection driving doctor / init / update / uninstall.
 *
 * - CLI presence on PATH (`which`/`where codegraph`, moved here from init.ts)
 * - project has a `.codegraph/` index
 * - which detected editors have the codegraph MCP configured
 */
export interface CodeGraphStatus {
    cliInstalled: boolean;
    indexed: boolean;
    /** Labels of editors that have the codegraph MCP installed. */
    mcpInstalledAdapters: string[];
}
export declare function detectCodeGraphStatus(projectRoot: string, homeDir?: string): CodeGraphStatus;
/**
 * Gap-aware hint lines for init/update. Returns content lines only (no
 * indentation or numbering — callers add their own prefix). Empty when
 * nothing needs suggesting. Hints only, never setup.
 */
export declare function codegraphHintLines(cg: CodeGraphStatus): string[];
