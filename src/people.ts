/**
 * The people a project's steps can wait on, other than the Developer: a team member, a lawyer, a
 * payments provider. Kept in .progressor/people.md, one per line:
 *
 *   # People
 *
 *   - Priya: payments lawyer ^p1
 *   - Stripe support ^p2
 *
 * The AI adds them as they come up (a step set to wait on someone new adds them); nothing needs setting up.
 */

export const PEOPLE_FILE = "people.md";
const HEADING = "# People";

export interface Person {
  /** Such as `p2`. */
  id: string;
  name: string;
  /** What they are to the project, such as "payments lawyer". */
  role?: string;
}

const ITEM = /^\s*[-*]\s+(.*?)\s*$/;
const ID = /^(.*?)\s+\^(p\d+)$/;
const idNumber = (id: string) => Number(id.slice(1));

/** The people in a people file; a line written by hand without an ID gets the next free one. */
export function parsePeople(text: string): Person[] {
  const items: { id?: string; text: string }[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = ITEM.exec(line);
    if (!m?.[1]) continue;
    const id = ID.exec(m[1]);
    items.push({ id: id?.[2], text: id ? id[1]! : m[1] });
  }
  let next = Math.max(0, ...items.flatMap((p) => (p.id ? [idNumber(p.id)] : []))) + 1;
  const seen = new Set<string>();
  return items.map((p) => {
    const id = p.id && !seen.has(p.id) ? p.id : `p${next++}`;
    seen.add(id);
    const at = p.text.indexOf(":");
    const name = (at > 0 ? p.text.slice(0, at) : p.text).trim();
    const role = at > 0 ? p.text.slice(at + 1).trim() : "";
    return { id, name, ...(role ? { role } : {}) };
  });
}

export function formatPeople(people: Person[]): string {
  if (people.length === 0) return `${HEADING}\n`;
  return `${HEADING}\n\n${people.map((p) => `- ${p.name}${p.role ? `: ${p.role}` : ""} ^${p.id}`).join("\n")}\n`;
}

export const nextPersonId = (people: Person[]): string => `p${Math.max(0, ...people.map((p) => idNumber(p.id))) + 1}`;

/** A person's name as one line, without the colon that starts the role. */
export const personName = (name: string): string => name.replace(/\s+/g, " ").replace(/:/g, " ").trim();

/** The person with this name (case and spacing don't count) or ID. */
export function findPerson(people: Person[], nameOrId: string): Person | undefined {
  const key = personName(nameOrId).toLowerCase();
  return people.find((p) => p.id === key || p.name.toLowerCase() === key);
}
