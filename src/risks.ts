/**
 * The project's risks list: what could go wrong, how likely and how bad, what would reduce it, who owns
 * it and the goals that reduce it. Kept in .progressor/risks.md, one section per risk:
 *
 *   # Risks
 *
 *   ## r1 Plan files swept into commits
 *   - likelihood: high
 *   - impact: medium
 *   - reduce it by: Keep the plan out of git
 *   - owner: your AI
 *   - goals: login, tests-ci-deps
 *   - status: open
 *
 * The AI fills it and keeps it current (save_risk); the Developer only reads it.
 */

export const RISKS_FILE = "risks.md";
const HEADING = "# Risks";

export const LEVELS = ["low", "medium", "high"] as const;
export type Level = (typeof LEVELS)[number];
export const RISK_STATUSES = ["open", "reduced", "closed"] as const;
export type RiskStatus = (typeof RISK_STATUSES)[number];

export interface Risk {
  /** Such as `r3`. */
  id: string;
  title: string;
  likelihood: Level;
  impact: Level;
  /** What would reduce it. */
  mitigation?: string;
  /** Who looks after it, such as "your AI" or "the Developer". */
  owner?: string;
  /** The goals whose work reduces it. */
  goals: string[];
  status: RiskStatus;
}

/** The fields a risk can be given or changed by; an empty mitigation or owner removes it. */
export interface RiskChanges {
  title?: string;
  likelihood?: Level;
  impact?: Level;
  mitigation?: string;
  owner?: string;
  goals?: string[];
  status?: RiskStatus;
}

const SECTION = /^##\s+(?:(r\d+)\s+)?(.*?)\s*$/;
const FIELD = /^\s*[-*]\s+([a-z ]+?)\s*:\s*(.*?)\s*$/i;
const MITIGATION = "reduce it by";

const level = (v: string | undefined): Level => {
  const l = v?.trim().toLowerCase();
  return (LEVELS as readonly string[]).includes(l ?? "") ? (l as Level) : "medium";
};
const status = (v: string | undefined): RiskStatus => {
  const s = v?.trim().toLowerCase();
  return (RISK_STATUSES as readonly string[]).includes(s ?? "") ? (s as RiskStatus) : "open";
};
const idNumber = (id: string) => Number(id.slice(1));

/** The risks in a risks file; a section written by hand without an ID gets the next free one. */
export function parseRisks(text: string): Risk[] {
  const raw: { id?: string; title: string; fields: Map<string, string> }[] = [];
  for (const line of text.split(/\r?\n/)) {
    const section = SECTION.exec(line);
    if (section) {
      if (section[2]) raw.push({ id: section[1], title: section[2], fields: new Map() });
      continue;
    }
    const field = FIELD.exec(line);
    const current = raw.at(-1);
    if (field && current) current.fields.set(field[1]!.toLowerCase(), field[2]!);
  }
  let next = Math.max(0, ...raw.flatMap((r) => (r.id ? [idNumber(r.id)] : []))) + 1;
  const seen = new Set<string>();
  return raw.map((r) => {
    const id = r.id && !seen.has(r.id) ? r.id : `r${next++}`;
    seen.add(id);
    const f = r.fields;
    const goals = (f.get("goals") ?? "")
      .split(",")
      .map((g) => g.trim())
      .filter(Boolean);
    return {
      id,
      title: r.title,
      likelihood: level(f.get("likelihood")),
      impact: level(f.get("impact")),
      ...(f.get(MITIGATION) ? { mitigation: f.get(MITIGATION)! } : {}),
      ...(f.get("owner") ? { owner: f.get("owner")! } : {}),
      goals,
      status: status(f.get("status")),
    };
  });
}

export function formatRisks(risks: Risk[]): string {
  if (risks.length === 0) return `${HEADING}\n`;
  const section = (r: Risk) =>
    [
      `## ${r.id} ${r.title}`,
      `- likelihood: ${r.likelihood}`,
      `- impact: ${r.impact}`,
      ...(r.mitigation ? [`- ${MITIGATION}: ${r.mitigation}`] : []),
      ...(r.owner ? [`- owner: ${r.owner}`] : []),
      ...(r.goals.length > 0 ? [`- goals: ${r.goals.join(", ")}`] : []),
      `- status: ${r.status}`,
    ].join("\n");
  return `${HEADING}\n\n${risks.map(section).join("\n\n")}\n`;
}

/** The next risk's ID: one past the highest in use. */
export function nextRiskId(risks: Risk[]): string {
  return `r${Math.max(0, ...risks.map((r) => idNumber(r.id))) + 1}`;
}

/** How much a risk matters: likelihood times impact, each 1 (low) to 3 (high). */
export const riskScore = (r: Pick<Risk, "likelihood" | "impact">): number => (LEVELS.indexOf(r.likelihood) + 1) * (LEVELS.indexOf(r.impact) + 1);

/** Open risks first, then reduced, then closed; within each, the highest score first, then by ID. */
export function sortedRisks(risks: Risk[]): Risk[] {
  return [...risks].sort(
    (a, b) => RISK_STATUSES.indexOf(a.status) - RISK_STATUSES.indexOf(b.status) || riskScore(b) - riskScore(a) || idNumber(a.id) - idNumber(b.id),
  );
}

/** A risk at or above this score (likelihood times impact) is serious. */
export const SERIOUS_SCORE = 6;

/** A goal still being worked on or waiting its turn; finished, dropped or missing goals do not reduce a risk. */
const goalIsOpen = (status: string | undefined): boolean => status !== undefined && status !== "done" && status !== "dropped";

/**
 * The serious risks nothing is reducing: open, scoring 6 or more, and with no linked goal still open
 * (none linked, every one finished or cancelled, or the goal no longer exists). `goalStatus` maps a
 * goal ID to its status. These are shown in Needs you.
 */
export function unreducedSeriousRisks(risks: Risk[], goalStatus: (goalId: string) => string | undefined): Risk[] {
  return sortedRisks(risks).filter((r) => r.status === "open" && riskScore(r) >= SERIOUS_SCORE && !r.goals.some((g) => goalIsOpen(goalStatus(g))));
}

/** A text field as one line: titles, mitigations and owners never break the file's layout. */
export const riskLine = (text: string): string => text.replace(/\s+/g, " ").trim();
