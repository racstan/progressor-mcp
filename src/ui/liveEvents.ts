// The dashboard's live connection to the server, shared by everything on the page. Browsers allow
// only six connections to one address at a time, and each open tab used to hold up to two live ones,
// so a few tabs could leave no room for the page's other requests and it stopped loading. Now a tab
// holds one, and lets go of it while it is hidden in the background.

type Handler = (e: MessageEvent<string>) => void;
type Handlers = Record<string, Handler>;
/** What is used of the browser's EventSource. */
interface Source {
  readonly readyState: number;
  addEventListener(type: string, f: Handler): void;
  removeEventListener(type: string, f: Handler): void;
  close(): void;
}
const OPEN = 1; // EventSource.OPEN

/**
 * One live connection to `url` for everyone who listens: it opens with the first listener and
 * closes when the last one leaves. `on` takes handlers by event name ("open", "error" and the
 * server's own events) and returns the function that stops listening. A listener that joins a
 * connection already open is told "open" straight away, as it would have been had it been first.
 * `pause` closes the connection (for a hidden tab) and `resume` opens a fresh one for every
 * listener, whose "open" handlers then catch up on what was missed.
 */
export function sharedEvents(url: string, open: (url: string) => Source = (u) => new EventSource(u) as unknown as Source) {
  const listeners = new Set<Handlers>();
  let source: Source | undefined;
  let paused = false;
  const attach = (s: Source, h: Handlers) => {
    for (const [type, f] of Object.entries(h)) s.addEventListener(type, f);
  };
  const detach = (s: Source, h: Handlers) => {
    for (const [type, f] of Object.entries(h)) s.removeEventListener(type, f);
  };
  const close = () => {
    source?.close();
    source = undefined;
  };
  const connect = () => {
    source = open(url);
    for (const h of listeners) attach(source, h);
  };
  return {
    on(handlers: Handlers): () => void {
      const h = { ...handlers }; // its own object, so the same handlers can join twice
      listeners.add(h);
      if (source) {
        attach(source, h);
        if (source.readyState === OPEN) h.open?.(new MessageEvent("open"));
      } else if (!paused) connect();
      return () => {
        if (!listeners.delete(h)) return;
        if (source) detach(source, h);
        if (listeners.size === 0) close();
      };
    },
    pause(): void {
      paused = true;
      close();
    },
    resume(): void {
      if (!paused) return;
      paused = false;
      if (listeners.size > 0 && !source) connect();
    },
  };
}

/**
 * For loads that can overlap (a change notice, the timer, a click): each load calls the result at
 * its start, and asks the returned function, once its answer is in, whether it is still the newest.
 * An older answer that arrives late is then dropped instead of replacing a newer one.
 */
export function newestOnly(): () => () => boolean {
  let latest = 0;
  return () => {
    const mine = ++latest;
    return () => mine === latest;
  };
}
