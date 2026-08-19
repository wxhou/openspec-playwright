import { execFileSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";
import { detectAdapters } from "../commands/editors.js";
import { isMcpInstalled } from "./mcp.js";
/** MCP server name codegraph registers into agents (`mcpServers` key). */
const CODEGRAPH_MCP_SERVER = "codegraph";
export function detectCodeGraphStatus(projectRoot, homeDir) {
    let cliInstalled = false;
    try {
        execFileSync(process.platform === "win32" ? "where" : "which", ["codegraph"], {
            stdio: "ignore",
        });
        cliInstalled = true;
    }
    catch {
        /* codegraph not installed — skip */
    }
    const mcpInstalledAdapters = detectAdapters(projectRoot, homeDir)
        .filter((adapter) => isMcpInstalled(adapter, CODEGRAPH_MCP_SERVER))
        .map((adapter) => adapter.label);
    return {
        cliInstalled,
        indexed: existsSync(join(projectRoot, ".codegraph")),
        mcpInstalledAdapters,
    };
}
/**
 * Gap-aware hint lines for init/update. Returns content lines only (no
 * indentation or numbering — callers add their own prefix). Empty when
 * nothing needs suggesting. Hints only, never setup.
 */
export function codegraphHintLines(cg) {
    if (cg.indexed) {
        const lines = ["Refresh code index: codegraph sync"];
        if (cg.mcpInstalledAdapters.length === 0) {
            lines.push("Install code hooks: codegraph install --target=auto --location=local");
        }
        return lines;
    }
    if (cg.cliInstalled) {
        return ["Build code index (optional): codegraph init"];
    }
    return [];
}
//# sourceMappingURL=codegraph.js.map