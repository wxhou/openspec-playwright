import { describe, it, expect } from "vitest";
import {
  getAllAdapters,
  slashCommandForAdapter,
  type EditorAdapter,
} from "../src/commands/editors.js";

// The slash-command hint used to be an id whitelist inside the registry
// ("claude" | "codebuddy" → colon). A new editor could join the registry
// and still be hinted with the wrong command form. The form now travels
// with the adapter.

const COLON_FORM = ["claude", "codebuddy"];

describe("slash-command form comes from the adapter", () => {
  it("derives the hint from commandForm, not from the adapter id", () => {
    for (const adapter of getAllAdapters()) {
      const expected =
        adapter.commandForm === "colon" ? "/opsx:e2e" : "/opsx-e2e";
      expect(slashCommandForAdapter(adapter)).toBe(expected);
    }
  });

  it("marks the command-file editors colon and the skill editors hyphen", () => {
    const byId = new Map(getAllAdapters().map((a) => [a.id, a]));
    for (const id of COLON_FORM) {
      expect(byId.get(id as EditorAdapter["id"])?.commandForm).toBe("colon");
    }
    for (const adapter of getAllAdapters()) {
      if (COLON_FORM.includes(adapter.id)) continue;
      expect(adapter.commandForm).toBe("hyphen");
    }
  });
});
