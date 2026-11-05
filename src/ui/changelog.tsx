// The changelog, read from CHANGELOG.md when the page is built, so What's new always matches the
// release. Only the little Markdown the changelog uses: ## releases, ### headings, paragraphs, - lists
// with indented sub-items, **bold**, *italic*, `code` and [links](...).
import type { ReactNode } from "react";

export type Block =
  | { kind: "p"; text: string }
  | { kind: "h"; text: string }
  | { kind: "list"; items: { text: string; sub: string[] }[] };
export interface Release { title: string; version: string; name?: string; blocks: Block[] }
export interface Changelog { intro: string[]; releases: Release[] }

export function parseChangelog(md: string): Changelog {
  const out: Changelog = { intro: [], releases: [] };
  let cur: Release | undefined;
  let list: Extract<Block, { kind: "list" }> | undefined;
  let para: Extract<Block, { kind: "p" }> | undefined;
  for (const raw of md.replace(/\r/g, "").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) { list = undefined; para = undefined; continue; }
    if (/^# /.test(line)) continue;
    const release = /^## (.*)$/.exec(line);
    if (release) {
      const title = release[1]!.trim();
      const [version, ...rest] = title.split(" · ");
      cur = { title, version: version!.trim(), name: rest.length ? rest.join(" · ").trim() : undefined, blocks: [] };
      out.releases.push(cur);
      list = undefined; para = undefined;
      continue;
    }
    if (!cur) { out.intro.push(line.trim()); continue; }
    const heading = /^### (.*)$/.exec(line);
    if (heading) { cur.blocks.push({ kind: "h", text: heading[1]!.trim() }); list = undefined; para = undefined; continue; }
    const item = /^[-*] (.*)$/.exec(line);
    if (item) {
      if (!list) cur.blocks.push(list = { kind: "list", items: [] });
      list.items.push({ text: item[1]!.trim(), sub: [] });
      para = undefined;
      continue;
    }
    const last = list?.items.at(-1);
    const sub = /^\s+[-*] (.*)$/.exec(line);
    if (sub && last) { last.sub.push(sub[1]!.trim()); continue; }
    if (/^\s/.test(line) && last) {
      if (last.sub.length) last.sub[last.sub.length - 1] += ` ${line.trim()}`;
      else last.text += ` ${line.trim()}`;
      continue;
    }
    list = undefined;
    if (para) para.text += ` ${line.trim()}`;
    else cur.blocks.push(para = { kind: "p", text: line.trim() });
  }
  return out;
}

export type Span =
  | { kind: "text" | "code"; text: string }
  | { kind: "b" | "i"; children: Span[] }
  | { kind: "link"; href?: string; children: Span[] };

const INLINE = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|\*([^*\s](?:[^*]*?[^*\s])?)\*/g;

/** The words of one line, with its bold, italic, code and links. A relative link is resolved against `base`, or dropped (its words kept) without one. */
export function spans(text: string, base?: string): Span[] {
  const out: Span[] = [];
  let at = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index > at) out.push({ kind: "text", text: text.slice(at, m.index) });
    if (m[1] !== undefined) out.push({ kind: "b", children: spans(m[1], base) });
    else if (m[2] !== undefined) out.push({ kind: "code", text: m[2] });
    else if (m[3] !== undefined) out.push({ kind: "link", href: linkTo(m[4]!, base), children: spans(m[3], base) });
    else out.push({ kind: "i", children: spans(m[5]!, base) });
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push({ kind: "text", text: text.slice(at) });
  return out;
}

function linkTo(href: string, base?: string): string | undefined {
  if (/^https?:\/\//.test(href)) return href;
  return base ? base + href.replace(/^\.?\//, "") : undefined;
}

/** Plain elements (no components of their own), so a search can read their words. */
export function inline(text: string, base?: string): ReactNode[] {
  const draw = (s: Span, i: number): ReactNode => {
    switch (s.kind) {
      case "text": return s.text;
      case "code": return <code key={i}>{s.text}</code>;
      case "b": return <b key={i}>{s.children.map(draw)}</b>;
      case "i": return <i key={i}>{s.children.map(draw)}</i>;
      case "link": return s.href
        ? <a key={i} href={s.href} target="_blank" rel="noopener noreferrer">{s.children.map(draw)}</a>
        : <span key={i}>{s.children.map(draw)}</span>;
    }
  };
  return spans(text, base).map(draw);
}

export function releaseBody(r: Release, base?: string): ReactNode {
  return r.blocks.map((b, i) =>
    b.kind === "h" ? <h4 key={i}>{inline(b.text, base)}</h4>
    : b.kind === "p" ? <p key={i}>{inline(b.text, base)}</p>
    : (
      <ul key={i}>
        {b.items.map((it, j) => (
          <li key={j}>
            {inline(it.text, base)}
            {it.sub.length > 0 && <ul>{it.sub.map((s, k) => <li key={k}>{inline(s, base)}</li>)}</ul>}
          </li>
        ))}
      </ul>
    ));
}
