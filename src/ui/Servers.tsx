// The Servers panel: every running Progressor process (one per Agent conversation, plus any
// `progressor-mcp dashboard` command), with a Stop button behind a confirm.
import { useState } from "react";
import { type InfoView, type ServersView, stopServer } from "./data.js";

type Server = ServersView["servers"][number];

const megabytes = (bytes: number) => `${Math.round(bytes / 1_048_576)} MB`;

function age(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours} h ago` : `${Math.floor(hours / 24)} d ago`;
}

function confirmText(s: Server, others: number): string {
  const what =
    s.kind === "dashboard"
      ? `Stop the dashboard command for ${s.root}?`
      : `Stop the Progressor server for ${s.name}? That Claude Code conversation loses Progressor's tools until it restarts.`;
  if (!s.serving) return what;
  return others > 0
    ? `${what}\n\nThis one serves the dashboard; another running server takes it over within a few seconds.`
    : `${what}\n\nThis is the only one running, so the dashboard goes away until a server starts again.`;
}

export function ServersPanel({ servers, hub, reload, toast }: {
  servers: ServersView | "unsupported" | undefined;
  /** The process serving this page, as /api/info describes it. */
  hub: InfoView | undefined;
  reload: () => void;
  toast: (m: string) => void;
}) {
  const [stopping, setStopping] = useState<Set<number>>(new Set());
  if (servers === "unsupported")
    return (
      <section>
        <h3>Running servers</h3>
        <p className="empty">
          This page is served by an older Progressor{hub?.version ? ` (${hub.version})` : ""}, which cannot list servers. Close that
          process and a newer one takes the dashboard over within a few seconds: end any <code>progressor-mcp dashboard</code> command
          you left running, and restart the Claude Code conversations that started before you updated.
        </p>
      </section>
    );
  const list = servers?.servers ?? [];
  const stop = async (s: Server) => {
    if (!confirm(confirmText(s, list.length - 1))) return;
    try {
      await stopServer(s.pid);
      setStopping((prev) => new Set(prev).add(s.pid));
      toast(`Asked ${s.name} to stop.`);
      setTimeout(reload, 1500);
    } catch (e) {
      toast(`Could not stop it: ${(e as Error).message}`);
    }
  };
  const total = list.reduce((sum, s) => sum + s.memory, 0);
  return (
    <section>
      <h3>Running servers</h3>
      {!servers && <p className="empty">Loading…</p>}
      {servers && list.length === 0 && <p className="empty">None listed.</p>}
      {list.map((s) => (
        <div key={s.pid} className={`server ${stopping.has(s.pid) ? "stopping" : ""}`}>
          <div className="server-head">
            <b>{s.name}</b>
            {s.serving && <span className="badge" title="This process serves the page you are looking at">serves this dashboard</span>}
            <span className="sp" />
            <button className="stop" disabled={stopping.has(s.pid)} onClick={() => void stop(s)}
              aria-label={`Stop the server for ${s.name}`}>
              {stopping.has(s.pid) ? "Stopping…" : "Stop"}
            </button>
          </div>
          <div className="server-path" title={s.root}>{s.root}</div>
          <div className="server-meta">
            <span>{s.kind === "dashboard" ? "📊 dashboard command" : s.goal ? `🎯 ${s.goal.title}` : "No Goal claimed"}</span>
            <span>{megabytes(s.memory)}</span>
            <span title={new Date(s.startedAt).toLocaleString()}>started {age(s.startedAt)}</span>
            <span>pid {s.pid}</span>
          </div>
        </div>
      ))}
      {list.length > 0 && (
        <p className="hint">
          {list.length} {list.length === 1 ? "process" : "processes"}, {megabytes(total)} in all. Each Agent conversation runs its own
          server; one of them serves this dashboard. Servers from Progressor 0.3.0 or older are not listed.
        </p>
      )}
    </section>
  );
}
