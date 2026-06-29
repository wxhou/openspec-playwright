/**
 * Shared MCP (Model Context Protocol) utilities.
 *
 * Dispatches Playwright MCP install/remove to the right editor adapter.
 * Each adapter handles its own install mechanism (`claude mcp add` vs
 * editing `opencode.jsonc`), so this layer just routes the call and
 * prints status messages.
 */
import { type EditorAdapter } from "../commands/editors.js";
/** Check if the named MCP server is installed in this editor. */
export declare function isMcpInstalled(adapter: EditorAdapter, serverName: string): boolean;
/** Install an MCP server in this editor. Throws on failure. */
export declare function ensureMcp(adapter: EditorAdapter, serverName: string, command: string[]): void;
/** Remove an MCP server from this editor. Does not throw if missing. */
export declare function removeMcp(adapter: EditorAdapter, serverName: string): void;
export declare function isPlaywrightMcpInstalled(adapter: EditorAdapter): boolean;
export declare function ensurePlaywrightMcp(adapter: EditorAdapter): void;
export declare function removePlaywrightMcp(adapter: EditorAdapter): void;
