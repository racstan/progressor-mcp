/** Where Progressor's issues live; the Help panel links here. */
export const ISSUES_URL = "https://github.com/racstan/progressor-mcp/issues";

/**
 * A link to a new GitHub issue on one of the repo's issue forms (.github/ISSUE_TEMPLATE/), with the
 * fields the page knows already filled in: GitHub fills a form field from the query parameter of
 * the same id. A bug report gets the system too; an idea does not need it.
 */
export function issueUrl(kind: "bug" | "idea", known: { version?: string; system?: string }): string {
  const p = new URLSearchParams({ template: kind === "bug" ? "bug_report.yml" : "idea.yml" });
  if (known.version) p.set("version", known.version);
  if (kind === "bug" && known.system) p.set("system", known.system);
  return `${ISSUES_URL}/new?${p}`;
}

/** The OS and browser from a user agent, such as "Windows · Chrome 141", for a bug report. */
export function describeSystem(ua: string): string {
  const os = /Windows/.test(ua) ? "Windows"
    : /Mac OS X|Macintosh/.test(ua) ? "macOS"
    : /Android/.test(ua) ? "Android"
    : /Linux|X11/.test(ua) ? "Linux"
    : "unknown OS";
  // Edge and Chrome both say Chrome, and Chrome says Safari, so the most specific comes first.
  const browsers: [string, RegExp][] = [
    ["Edge", /Edg\/(\d+)/],
    ["Firefox", /Firefox\/(\d+)/],
    ["Chrome", /Chrome\/(\d+)/],
    ["Safari", /Version\/(\d+).*Safari/],
  ];
  for (const [name, re] of browsers) {
    const m = re.exec(ua);
    if (m) return `${os} · ${name} ${m[1]}`;
  }
  return `${os} · unknown browser`;
}
