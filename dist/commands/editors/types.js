/**
 * Core types for the editor adapter layer: command metadata, the runtime
 * `EditorAdapter` surface, and the declarative `AdapterDeclaration` that
 * `declaration.ts` compiles into it. Zero internal dependencies — every
 * other editors/* module may import from this file.
 */
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
//# sourceMappingURL=types.js.map