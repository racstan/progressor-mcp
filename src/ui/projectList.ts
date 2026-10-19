// The projects in the overview and the switcher, as one flat list.

interface Entry {
  id: string;
  name: string;
  root: string;
  goals?: { status: string }[];
}

const busy = (p: Entry) => (p.goals ?? []).some((g) => g.status === "active" || g.status === "paused");

/** Projects with a Goal in progress first, then the others; each part by name, ignoring case. */
export function sortProjects<P extends Entry>(projects: P[]): P[] {
  return [...projects].sort(
    (a, b) => Number(busy(b)) - Number(busy(a)) || a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) || a.root.localeCompare(b.root),
  );
}
