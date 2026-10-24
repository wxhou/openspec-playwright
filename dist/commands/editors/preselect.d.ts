import type { EditorId } from "./types.js";
/** Editors whose declared root intent files exist in the project. */
export declare function intentFileEditors(projectRoot: string): EditorId[];
