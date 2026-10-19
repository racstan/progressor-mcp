// Search across every project on the dashboard: projects, Goals, Tasks and Ideas. Each search reads
// the projects as they are now, so it never goes stale; a hit says where it lives so the page can
// open it.

export interface SearchableProject {
  id: string;
  name: string;
  root: string;
  goals: {
    id: string;
    title: string;
    status: string;
    outcome?: string | undefined;
    tasks: { id: string; title: string; status: string; summary?: string | undefined }[];
  }[];
  ideas: { id?: string | undefined; title: string; notes: string[] }[];
}

export type SearchKind = "project" | "goal" | "task" | "idea";

export interface SearchHit {
  kind: SearchKind;
  project: { id: string; name: string };
  /** The Goal a Task belongs to. */
  goal?: { id: string; title: string };
  /** The Goal's, Task's or Idea's ID. */
  id?: string;
  title: string;
  /** A second line: a project's folder, a Goal's Outcome, a Task's summary or an Idea's first note. */
  detail?: string;
  status?: string;
}

const KIND_WEIGHT: Record<SearchKind, number> = { project: 4, goal: 3, task: 2, idea: 1 };
const LIVE = new Set(["active", "paused", "in progress"]);
const OVER = new Set(["done", "dropped"]);

/**
 * The items containing every word of the query (in their title, details, Goal or project name),
 * best first: more words in the title, then projects before Goals before Tasks before Ideas, work in
 * progress before work that is over.
 */
export function search(projects: SearchableProject[], query: string, limit = 30): SearchHit[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const scored: { hit: SearchHit; score: number }[] = [];
  const consider = (hit: SearchHit, ...context: (string | undefined)[]) => {
    const text = [hit.title, hit.detail, ...context].filter(Boolean).join("\n").toLowerCase();
    if (!words.every((w) => text.includes(w))) return;
    const title = hit.title.toLowerCase();
    const inTitle = words.filter((w) => title.includes(w)).length;
    const status = hit.status ?? "";
    const score = inTitle * 3 + KIND_WEIGHT[hit.kind] + (LIVE.has(status) ? 2 : OVER.has(status) ? -1 : 0);
    scored.push({ hit, score });
  };

  for (const p of projects) {
    const project = { id: p.id, name: p.name };
    consider({ kind: "project", project, title: p.name, detail: p.root });
    for (const g of p.goals) {
      consider({ kind: "goal", project, id: g.id, title: g.title, detail: g.outcome, status: g.status }, p.name);
      for (const t of g.tasks)
        consider({ kind: "task", project, goal: { id: g.id, title: g.title }, id: t.id, title: t.title, detail: t.summary, status: t.status }, g.title, p.name);
    }
    for (const i of p.ideas) consider({ kind: "idea", project, id: i.id, title: i.title, detail: i.notes[0] }, ...i.notes.slice(1), p.name);
  }
  return scored
    .sort((a, b) => b.score - a.score || a.hit.title.localeCompare(b.hit.title))
    .slice(0, limit)
    .map((s) => s.hit);
}
