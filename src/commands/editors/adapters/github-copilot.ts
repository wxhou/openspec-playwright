/**
 * GitHub Copilot adapter (VS Code surface): prompt file at
 * `.github/prompts/opsx-<id>.prompt.md`, MCP in `.vscode/mcp.json`
 * (`servers` map with `type: "stdio"` entries), full standards in
 * `.github/copilot-instructions.md`.
 *
 * Detection uses Copilot-specific markers only — a bare `.github/` (present
 * in every GitHub repository) or `.vscode/` must not select this adapter.
 */
import { join } from "path";
import type {
  AdapterDeclaration,
  ArtifactSpec,
  CommandMeta,
} from "../types.js";
import { defineAdapter } from "../declaration.js";
import { formatArtifact } from "../shared.js";
import { registerAdapter } from "../registry.js";

// ─── GitHub Copilot adapter ───────────────────────────────────────────────

export function getCopilotPromptPath(id: string): string {
  return join(".github", "prompts", `opsx-${id}.prompt.md`);
}

/** VS Code prompt files: markdown with a `description` frontmatter field. */
const COPILOT_PROMPT: ArtifactSpec = {
  path: getCopilotPromptPath,
  naming: "hyphen-prefix",
  frontmatter: { description: true },
};

const githubCopilotDeclaration: AdapterDeclaration = {
  id: "github-copilot",
  label: "github-copilot",
  displayName: "GitHub Copilot",
  artifacts: [COPILOT_PROMPT],
  detection: {
    projectPaths: [
      ".github/copilot-instructions.md",
      ".github/instructions",
      ".github/prompts",
      ".github/agents",
      ".github/skills",
      ".github/workflows/copilot-setup-steps.yml",
    ],
    globalPaths: [".copilot"],
  },
  mcp: {
    kind: "vscode-servers-file",
    path: (root) => join(root, ".vscode", "mcp.json"),
  },
  rules: {
    path: (root) => join(root, ".github", "copilot-instructions.md"),
    mode: "full",
  },
};

export const githubCopilotAdapter = defineAdapter(githubCopilotDeclaration);

// ─── Named exports (derived from the declaration) ────────────────────────

export function formatCopilotPrompt(meta: CommandMeta): string {
  return formatArtifact(COPILOT_PROMPT, meta);
}

export function hasGithubCopilot(
  projectRoot: string,
  homeDir?: string,
): boolean {
  return githubCopilotAdapter.detect(projectRoot, homeDir);
}

registerAdapter(githubCopilotAdapter);
