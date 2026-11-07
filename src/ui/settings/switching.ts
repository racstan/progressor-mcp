// Switching where the dashboard runs (Background.tsx). The process serving this page may change on
// the way: the background dashboard takes the serving over from an AI chat's process, or stops and an
// AI chat's process takes it back. So a request that loses its connection is not a failure: the page
// says it is reconnecting, and asks again until the new server answers with what was asked for.

export interface SwitchView {
  background: boolean;
  status: { serving: boolean } | null;
  text: string;
}

export interface SwitchIo<V extends SwitchView> {
  /** Asks the server to switch; throws a TypeError when the connection is lost, an Error with words when refused. */
  post(background: boolean): Promise<V>;
  get(): Promise<V>;
  sleep(ms: number): Promise<void>;
  now(): number;
  onReconnecting(): void;
}

export const WAIT_TEXT = {
  on: "Setting up the background dashboard. Please wait, this can take up to about 20 seconds. Keep this page open.",
  off: "Switching back. Please wait, this can take up to about 20 seconds. Keep this page open.",
};
export const DONE_TEXT = {
  on: "Done. The dashboard now runs in the background and starts when you log in.",
  off: "Done. The dashboard runs with your AI chats again.",
  /** Switched back, and no AI chat is open to serve the page. */
  offAlone: "Done. The background dashboard has stopped, so this page comes back when your AI's app is open.",
};

/** Whether the server says the switch is done: set up and running, or taken away and stopped. */
export const settled = (background: boolean, v: SwitchView) => (background ? v.background && v.status !== null : !v.background && v.status === null);

/** A lost connection, as fetch reports it, rather than the server saying no. */
const lost = (e: unknown) => e instanceof TypeError;

export async function switchWhere<V extends SwitchView>(
  background: boolean,
  io: SwitchIo<V>,
  { waitMs = 30_000, everyMs = 1000 } = {},
): Promise<{ ok: true; view: V | undefined } | { ok: false; error: string }> {
  let reconnecting = false;
  const reconnect = () => {
    if (!reconnecting) io.onReconnecting();
    reconnecting = true;
  };
  let asked = false;
  try {
    const view = await io.post(background);
    asked = true;
    if (settled(background, view)) return { ok: true, view };
  } catch (e) {
    if (!lost(e)) return { ok: false, error: (e as Error).message };
    reconnect();
  }
  const end = io.now() + waitMs;
  while (io.now() < end) {
    await io.sleep(everyMs);
    try {
      const view = await io.get();
      if (settled(background, view)) return { ok: true, view };
    } catch (e) {
      if (!lost(e)) return { ok: false, error: (e as Error).message };
      reconnect();
    }
  }
  // Switching back with no AI chat open: nothing serves the page any more, which is as asked.
  if (!background && asked) return { ok: true, view: undefined };
  return {
    ok: false,
    error: background
      ? "The background dashboard didn't answer in time. Reload the page in a moment; what it said is in ~/.progressor/daemon.log."
      : "The page lost touch with Progressor while switching back. Reload it in a moment.",
  };
}
