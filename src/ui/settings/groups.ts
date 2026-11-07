// The groups the Settings page shows its sections in, each with a link in the page's own menu.

export type SettingsGroupId = "look" | "notifications" | "plan" | "records" | "advanced";

export const SETTINGS_GROUPS: { id: SettingsGroupId; title: string; blurb: string }[] = [
  { id: "look", title: "Look", blurb: "How this page looks, kept in this browser." },
  { id: "notifications", title: "Notifications", blurb: "Being told when something happens, on this computer or your phone." },
  { id: "plan", title: "AI & plan", blurb: "How your AI plans and records the work, kept on this computer." },
  { id: "records", title: "History & releases", blurb: "Undoing changes to the plan and turning finished goals into releases." },
  { id: "advanced", title: "Advanced", blurb: "For people who look at the code." },
];

/** The groups that have sections, in order, each with its sections in the order given. */
export function groupSections<S extends { id: string; group: SettingsGroupId }>(sections: S[]) {
  return SETTINGS_GROUPS.map((g) => ({ ...g, sections: sections.filter((s) => s.group === g.id) })).filter((g) => g.sections.length > 0);
}
