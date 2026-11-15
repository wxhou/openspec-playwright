import type { TemplateTarget } from "./app-detect.js";

export interface WorkflowRenderOptions {
  target: TemplateTarget;
  /** Script name from package.json (e.g. build:mp-weixin); null = no step. */
  buildCommand?: string | null;
}

const BROWSER_LINE =
  /^(\s*)(-\s+)?run: npx playwright install --with-deps(?: chromium| chrome)?\s*$/gm;
// Steps that actually run the mini program. In the auto-pipeline the agent
// edits source in an earlier step, so a build placed right after the browser
// install would leave E2E and the final gate testing stale output.
const E2E_STEP = /^(\s*)- name: (?:Generate E2E tests|Gate)\s*$/;

/**
 * True when the step's command block runs E2E. A gate restricted with
 * `--only` to static checks does not, so building before it would only add
 * minutes to every pull request.
 */
function stepRunsE2E(lines: string[], index: number, indent: number): boolean {
  for (let i = index + 1; i < lines.length; i++) {
    const line = lines[i];
    const nextStep = line.match(/^(\s*)- name:/);
    if (nextStep && nextStep[1].length === indent) break;
    const only = line.match(/--only\s+([\w,-]+)/);
    if (only && !only[1].split(",").includes("e2e")) return false;
  }
  return true;
}

/**
 * Render a workflow template for the target. Web returns the input unchanged
 * (byte-identical, so `remove` keeps recognizing existing files); the
 * mini-program target installs Google Chrome and runs the build before the
 * steps that execute E2E. When a template has no such named steps (the simple
 * workflow), the build follows the browser install instead.
 */
export function renderWorkflowTemplate(
  template: string,
  options: WorkflowRenderOptions,
): string {
  if (options.target !== "miniprogram") return template;

  const lines = template.split("\n");
  const out: string[] = [];
  let inserted = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const step = line.match(E2E_STEP);
    if (
      step &&
      options.buildCommand &&
      stepRunsE2E(lines, i, step[1].length)
    ) {
      out.push(`${step[1]}- run: npm run ${options.buildCommand}`);
      inserted = true;
    }
    out.push(
      line.replace(
        BROWSER_LINE,
        (_match, indent: string, dash: string | undefined) =>
          `${indent}${dash ?? ""}run: npx playwright install --with-deps chrome`,
      ),
    );
  }

  let rendered = out.join("\n");
  if (options.buildCommand && !inserted) {
    // A step written as `- name: ...` + `run:` needs the new step at the dash
    // column, one level left of the run line.
    rendered = rendered.replace(
      BROWSER_LINE,
      (line: string, indent: string, dash: string | undefined) => {
        const stepIndent = dash ? indent : indent.slice(0, Math.max(0, indent.length - 2));
        return `${line}\n${stepIndent}- run: npm run ${options.buildCommand}`;
      },
    );
  }
  return rendered;
}
