// Projects grouped by the Workspace they were found in, for the switcher and the overview page.

interface Entry {
  id: string;
  name: string;
  root: string;
}

export interface WorkspaceGroup<P> {
  /** Undefined for the projects that are in no Workspace. */
  workspace: Entry | undefined;
  projects: P[];
}

/** One group per Workspace (by name), then the projects in no Workspace; empty groups are left out. */
export function groupByWorkspace<P extends Entry & { workspace?: string }>(projects: P[], workspaces: Entry[]): WorkspaceGroup<P>[] {
  const groups: WorkspaceGroup<P>[] = [...workspaces]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((workspace) => ({ workspace, projects: projects.filter((p) => p.workspace === workspace.id) }));
  groups.push({ workspace: undefined, projects: projects.filter((p) => !workspaces.some((w) => w.id === p.workspace)) });
  return groups.filter((g) => g.projects.length > 0);
}

/** Where a project sits inside its Workspace, such as "clients/acme/api", or "." for the Workspace folder itself. */
export function placeIn(root: string, workspace: Entry | undefined): string {
  if (!workspace || !root.toLowerCase().startsWith(workspace.root.toLowerCase())) return root;
  return root.slice(workspace.root.length).replace(/^[\\/]+/, "").replaceAll("\\", "/") || ".";
}
