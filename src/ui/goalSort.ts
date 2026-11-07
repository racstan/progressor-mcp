// The order of the Dashboard page's "Each goal" list: newest or oldest first, by time spent, by how
// far over the estimate, by side trips, or A to Z. The plan lists goals oldest first.

export type GoalSort = "newest" | "oldest" | "time" | "over" | "sideTrips" | "az";

export const GOAL_SORTS: { id: GoalSort; label: string; heading: string }[] = [
  { id: "newest", label: "Newest first", heading: "newest first" },
  { id: "oldest", label: "Oldest first", heading: "oldest first" },
  { id: "time", label: "Longest time spent", heading: "longest time spent first" },
  { id: "over", label: "Most over its estimate", heading: "most over its estimate first" },
  { id: "sideTrips", label: "Most side trips", heading: "most side trips first" },
  { id: "az", label: "A to Z", heading: "A to Z" },
];

/** A remembered sort, or newest first when there is none or it is not one of the sorts. */
export const readGoalSort = (v: string | null | undefined): GoalSort => GOAL_SORTS.find((s) => s.id === v)?.id ?? "newest";

interface Sortable {
  title: string;
  spent: number;
  estimate: number | undefined;
  sideTrips: number;
}

/** A sorted copy of `goals` (given oldest first); ties keep the newest first. */
export function sortGoals<G extends Sortable>(goals: G[], sort: GoalSort): G[] {
  const newest = [...goals].reverse();
  const over = (a: G, b: G) => {
    if (a.estimate === undefined || b.estimate === undefined) return Number(a.estimate === undefined) - Number(b.estimate === undefined);
    return b.spent - b.estimate - (a.spent - a.estimate);
  };
  switch (sort) {
    case "newest":
      return newest;
    case "oldest":
      return [...goals];
    case "time":
      return newest.sort((a, b) => b.spent - a.spent);
    case "over":
      return newest.sort(over);
    case "sideTrips":
      return newest.sort((a, b) => b.sideTrips - a.sideTrips);
    case "az":
      return newest.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
  }
}
