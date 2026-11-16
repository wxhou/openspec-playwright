import { describe, it, expect } from "vitest";
import { renderWorkflowTemplate } from "../../src/shared/workflow-render.js";

const TEMPLATE = `      - run: npx playwright install --with-deps chromium
      - run: npx playwright test
`;

describe("renderWorkflowTemplate", () => {
  it("returns the web template byte-identically", () => {
    expect(renderWorkflowTemplate(TEMPLATE, { target: "web" })).toBe(TEMPLATE);
  });

  it("installs Chrome and adds the build step after the browser install", () => {
    const rendered = renderWorkflowTemplate(TEMPLATE, {
      target: "miniprogram",
      buildCommand: "npm run build:mp-weixin",
    });
    expect(rendered).toContain("npx playwright install --with-deps chrome");
    expect(rendered).not.toContain("--with-deps chromium");
    expect(rendered).toContain(
      "      - run: npx playwright install --with-deps chrome\n      - run: npm run build:mp-weixin\n      - run: npx playwright test",
    );
  });

  it("does not insert a build step when no build script exists", () => {
    const rendered = renderWorkflowTemplate(TEMPLATE, {
      target: "miniprogram",
      buildCommand: null,
    });
    expect(rendered).not.toContain("npm run");
  });

  it("adds the build step in every job that installs a browser", () => {
    const twoJobs = `      - run: npx playwright install --with-deps chromium
      - run: npx playwright install --with-deps chromium
`;
    const rendered = renderWorkflowTemplate(twoJobs, {
      target: "miniprogram",
      buildCommand: "npm run build:weapp",
    });
    expect(rendered.match(/npm run build:weapp/g)).toHaveLength(2);
  });

  it("places a new step at the dash column for name+run steps", () => {
    const named = `      - name: Install Playwright browsers
        run: npx playwright install --with-deps
      - name: Run tests
        run: npx playwright test
`;
    const rendered = renderWorkflowTemplate(named, {
      target: "miniprogram",
      buildCommand: "npm run build:mp-weixin",
    });
    expect(rendered).toContain(
      "      - run: npm run build:mp-weixin\n      - name: Run tests",
    );
  });

  it("builds before the steps that run E2E, not before the agent edits source", () => {
    const pipeline = `      - run: npx playwright install --with-deps chromium
      - name: Apply change
        run: claude -p "/opsx:apply"
      - name: Generate E2E tests
        run: claude -p "/opsx:e2e"
      - name: Gate
        run: openspec-pw gate
`;
    const rendered = renderWorkflowTemplate(pipeline, {
      target: "miniprogram",
      buildCommand: "npm run build:mp-weixin",
    });
    expect(rendered).not.toContain(
      "npx playwright install --with-deps chrome\n      - run: npm run build:mp-weixin",
    );
    expect(rendered).toContain(
      "      - run: npm run build:mp-weixin\n      - name: Generate E2E tests",
    );
    expect(rendered).toContain(
      "      - run: npm run build:mp-weixin\n      - name: Gate",
    );
    expect(rendered.indexOf("npm run build:mp-weixin")).toBeGreaterThan(
      rendered.indexOf("- name: Apply change"),
    );
  });
});
