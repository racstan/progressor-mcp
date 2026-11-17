// How the Developer arranged their projects on the dashboard: named groups, and the order they dragged
// projects into. Kept on this computer beside the project list (routes/layout.ts), so every browser
// shows the same. Pure, so it is tested; a project nobody placed keeps the usual order.

export interface ProjectLayout {
  groups: { id: string; name: string }[];
  /** Project IDs in the order chosen, across every group; projects not in it come after, in the usual order. */
  order: string[];
  /** Which group a project is in, by project ID; a project in none is in the list above the groups. */
  groupOf: Record<string, string>;
}

export const EMPTY_LAYOUT: ProjectLayout = { groups: [], order: [], groupOf: {} };

const MAX_GROUPS = 50;
const MAX_NAME = 60;
const MAX_IDS = 2000;
const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const safeId = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 200 && v !== "__proto__";

/**
 * The projects in their sections: first those in no group, then each group in order (an empty one
 * too, so a project can be dropped into it). `projects` comes in the usual order.
 */
export function arrange<P extends { id: string }>(projects: readonly P[], layout: ProjectLayout): { group?: { id: string; name: string }; projects: P[] }[] {
  const groupIds = new Set(layout.groups.map((g) => g.id));
  const groupOf = (id: string) => (own(layout.groupOf, id) && groupIds.has(layout.groupOf[id]!) ? layout.groupOf[id] : undefined);
  const rank = new Map(layout.order.map((id, i) => [id, i]));
  const usual = new Map(projects.map((p, i) => [p.id, i]));
  const sorted = [...projects].sort((a, b) => (rank.get(a.id) ?? MAX_IDS + usual.get(a.id)!) - (rank.get(b.id) ?? MAX_IDS + usual.get(b.id)!));
  return [
    { projects: sorted.filter((p) => groupOf(p.id) === undefined) },
    ...layout.groups.map((group) => ({ group, projects: sorted.filter((p) => groupOf(p.id) === group.id) })),
  ];
}

/**
 * Moves a project into a group (undefined: no group), just before another project, or to the end of
 * that group when `beforeId` is undefined. Every project gets its place in `order`, so the list shown
 * stays as it was apart from the move.
 */
export function moveProject<P extends { id: string }>(layout: ProjectLayout, projects: readonly P[], id: string, toGroup: string | undefined, beforeId: string | undefined): ProjectLayout {
  if (toGroup !== undefined && !layout.groups.some((g) => g.id === toGroup)) toGroup = undefined;
  const sections = arrange(projects, layout);
  const groupOf: Record<string, string> = {};
  for (const s of sections) for (const p of s.projects) if (s.group && p.id !== id) groupOf[p.id] = s.group.id;
  if (toGroup !== undefined) groupOf[id] = toGroup;
  // The flat order with the project taken out, then put back where it was dropped.
  const flat = sections.flatMap((s) => s.projects.map((p) => p.id)).filter((x) => x !== id);
  let at = beforeId !== undefined && beforeId !== id ? flat.indexOf(beforeId) : -1;
  if (at < 0) {
    // the end of its group: after the last project in it, else where the group's section starts
    const inGroup = (x: string) => (own(groupOf, x) ? groupOf[x] : undefined) === toGroup;
    const last = flat.reduce((found, x, i) => (inGroup(x) ? i : found), -1);
    at = last >= 0 ? last + 1 : toGroup === undefined ? 0 : flat.length;
  }
  flat.splice(at, 0, id);
  return { groups: layout.groups, order: flat, groupOf };
}

const named = (name: string) => {
  const n = name.trim().slice(0, MAX_NAME);
  if (!n) throw new Error("Give the group a name.");
  return n;
};

/** Adds a group at the end; returns the layout and the new group's ID. */
export function addGroup(layout: ProjectLayout, name: string): { layout: ProjectLayout; id: string } {
  if (layout.groups.length >= MAX_GROUPS) throw new Error(`There can be at most ${MAX_GROUPS} groups.`);
  const n = Math.max(0, ...layout.groups.map((g) => Number(/^g(\d+)$/.exec(g.id)?.[1] ?? 0))) + 1;
  const id = `g${n}`;
  return { layout: { ...layout, groups: [...layout.groups, { id, name: named(name) }] }, id };
}

export function renameGroup(layout: ProjectLayout, id: string, name: string): ProjectLayout {
  const n = named(name);
  return { ...layout, groups: layout.groups.map((g) => (g.id === id ? { ...g, name: n } : g)) };
}

/** Moves a group up (-1) or down (+1) one place. */
export function moveGroup(layout: ProjectLayout, id: string, by: -1 | 1): ProjectLayout {
  const groups = [...layout.groups];
  const i = groups.findIndex((g) => g.id === id);
  const j = i + by;
  if (i < 0 || j < 0 || j >= groups.length) return layout;
  [groups[i], groups[j]] = [groups[j]!, groups[i]!];
  return { ...layout, groups };
}

/** Removes a group; its projects go back to the list above the groups. */
export function removeGroup(layout: ProjectLayout, id: string): ProjectLayout {
  const groupOf = Object.fromEntries(Object.entries(layout.groupOf).filter(([, g]) => g !== id));
  return { ...layout, groups: layout.groups.filter((g) => g.id !== id), groupOf };
}

/** A layout from a file or a request, keeping only what makes sense. */
export function cleanLayout(v: unknown): ProjectLayout {
  const o = (typeof v === "object" && v !== null ? v : {}) as Record<string, unknown>;
  const groups: ProjectLayout["groups"] = [];
  for (const g of Array.isArray(o.groups) ? o.groups : []) {
    const { id, name } = (g ?? {}) as Record<string, unknown>;
    if (!safeId(id) || typeof name !== "string" || !name.trim() || groups.some((x) => x.id === id)) continue;
    if (groups.length < MAX_GROUPS) groups.push({ id, name: name.trim().slice(0, MAX_NAME) });
  }
  const order = [...new Set((Array.isArray(o.order) ? o.order : []).filter(safeId))].slice(0, MAX_IDS);
  const ids = new Set(groups.map((g) => g.id));
  const groupOf: Record<string, string> = {};
  const given = (typeof o.groupOf === "object" && o.groupOf !== null ? o.groupOf : {}) as Record<string, unknown>;
  for (const [k, g] of Object.entries(given)) if (safeId(k) && typeof g === "string" && ids.has(g)) groupOf[k] = g;
  return { groups, order, groupOf };
}
