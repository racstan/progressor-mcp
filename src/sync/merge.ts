export interface MergeConflict {
  section: string;
  id: string;
  kept: "ours" | "theirs";
  lost: string;
}
export function mergePlanFile(_b: string | undefined, _o: string, _t: string, _opts?: { oursTime?: number; theirsTime?: number }): { text: string; conflicts: MergeConflict[] } {
  throw new Error("not built yet");
}
export function mergePlanFolder(..._a: unknown[]): { files: Map<string, string>; conflicts: (MergeConflict & { file: string })[] } {
  throw new Error("not built yet");
}
