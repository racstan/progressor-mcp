// The projects in the overview and the switcher, as one flat list.

interface Entry {
  id: string;
  name: string;
  root: string;
  goals?: { status: string; waitingOnYou?: boolean }[];
}

const busy = (p: Entry) => (p.goals ?? []).some((g) => g.status === "active" || g.status === "paused");

const needsYou = (p: Entry) => (p.goals ?? []).some((g) => g.waitingOnYou && (g.status === "active" || g.status === "paused"));

/** Projects with a step waiting on the Developer first, then those with a Goal in progress, then the others; each part by name, ignoring case. */
export function sortProjects<P extends Entry>(projects: P[]): P[] {
  return [...projects].sort(
    (a, b) => Number(needsYou(b)) - Number(needsYou(a)) || Number(busy(b)) - Number(busy(a)) || a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) || a.root.localeCompare(b.root),
  );
}
