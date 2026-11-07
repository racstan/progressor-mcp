// The Settings page: every section in the registry (settings/index.ts), grouped (settings/groups.ts)
// with a menu of the groups on the left on a wide window, each section with "Reset this section";
// then Support, "Reset all settings to defaults", where settings are kept, and the free notice.
import { useEffect, useRef, useState } from "react";
import { FreeNotice } from "./FreeNotice.js";
import { resetAll } from "./settings/reset.js";
import { groupSections } from "./settings/groups.js";
import { SETTINGS_SECTIONS, type SettingsContext, type SettingsSection } from "./settings/index.js";
import { RESET_ALL, RESET_ALL_CONFIRM, RESET_ALL_DONE, RESET_SECTION, SETTINGS_WHERE } from "./words.js";

/** The Developer's Buy Me a Coffee page, shown in Settings. */
const SUPPORT_URL = "https://buymeacoffee.com/rachitasthana";

function storage(): { removeItem(key: string): void } {
  try {
    return localStorage;
  } catch {
    return { removeItem: () => undefined };
  }
}

function ResetSection({ section, ctx }: { section: SettingsSection; ctx: SettingsContext }) {
  return (
    <button className="reset-section" title={`Put ${section.title} back to its default`}
      onClick={() =>
        void Promise.resolve()
          .then(() => section.reset(ctx))
          .then(() => ctx.toast(`${section.title} is back to its default.`))
          .catch((e: Error) => ctx.toast(e.message))
      }>
      {RESET_SECTION}
    </button>
  );
}

function Section({ section, ctx }: { section: SettingsSection; ctx: SettingsContext }) {
  const { Component } = section;
  return (
    <section className="settings-section" data-section={section.id}>
      <div className="settings-head">
        <h3>{section.title}</h3>
        <ResetSection section={section} ctx={ctx} />
      </div>
      <Component ctx={ctx} />
    </section>
  );
}

const ABOUT = { id: "about", title: "About" };

export function Settings({ ctx }: { ctx: SettingsContext }) {
  const [resetting, setResetting] = useState(false);
  const groups = groupSections(SETTINGS_SECTIONS);
  const [current, setCurrent] = useState(groups[0]?.id ?? ABOUT.id);
  // The menu marks the group being read as the page scrolls: the last one whose heading has passed the
  // top, or the last one of all at the bottom of the page. Just after a click, the clicked one stays marked.
  const clickedAt = useRef(0);
  useEffect(() => {
    const main = document.getElementById("main");
    if (!main) return;
    const onScroll = () => {
      if (Date.now() - clickedAt.current < 900) return;
      const groups = [...document.querySelectorAll<HTMLElement>(".settings-group")];
      const atBottom = main.scrollTop + main.clientHeight >= main.scrollHeight - 4;
      const top = main.getBoundingClientRect().top + 120;
      const passed = atBottom ? groups.at(-1) : groups.filter((g) => g.getBoundingClientRect().top <= top).at(-1);
      setCurrent((passed ?? groups[0])?.id.replace(/^settings-/, "") ?? ABOUT.id);
    };
    main.addEventListener("scroll", onScroll, { passive: true });
    return () => main.removeEventListener("scroll", onScroll);
  }, []);
  const go = (id: string) => {
    clickedAt.current = Date.now();
    setCurrent(id);
    document.getElementById(`settings-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const resetEverything = async () => {
    if (!confirm(RESET_ALL_CONFIRM)) return;
    setResetting(true);
    try {
      await resetAll(
        SETTINGS_SECTIONS.map((s) => ({ id: s.title, reset: () => s.reset(ctx) })),
        storage(),
        // A dashboard server from before settings were kept on this computer has none to reset.
        () => (ctx.computer === null ? Promise.resolve() : ctx.resetComputer()),
      );
      ctx.toast(RESET_ALL_DONE);
    } catch (e) {
      ctx.toast((e as Error).message);
    } finally {
      setResetting(false);
    }
  };
  return (
    <div className="page wide settings-page">
      <h1 className="page-title">Settings</h1>
      <p className="page-sub">Everything here is optional: Progressor and your AI work the same if you never open this page.</p>
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          {[...groups, ABOUT].map((g) => (
            <button key={g.id} aria-current={current === g.id} onClick={() => go(g.id)}>{g.title}</button>
          ))}
        </nav>
        <div className="settings-body">
          {groups.map((g) => (
            <section key={g.id} id={`settings-${g.id}`} className="settings-group" aria-labelledby={`settings-${g.id}-title`}>
              <h2 id={`settings-${g.id}-title`}>{g.title}</h2>
              <p className="settings-blurb">{g.blurb}</p>
              {g.sections.map((s) => (
                <Section key={s.id} section={s} ctx={ctx} />
              ))}
            </section>
          ))}
          <section id="settings-about" className="settings-group" aria-labelledby="settings-about-title">
            <h2 id="settings-about-title">{ABOUT.title}</h2>
            <section className="settings-section">
              <h3>Support Progressor</h3>
              <a className="card" href={SUPPORT_URL} target="_blank" rel="noopener noreferrer">
                Buy me a coffee
                <small>Progressor is free for personal and noncommercial use. If it keeps you on track, a coffee keeps it going.</small>
              </a>
            </section>
            <section className="settings-section reset-all">
              <h3>Start over</h3>
              <button className="btn ghost small" disabled={resetting} onClick={() => void resetEverything()}>
                {RESET_ALL}
              </button>
              <p className="hint">{SETTINGS_WHERE}</p>
            </section>
            <FreeNotice />
          </section>
        </div>
      </div>
    </div>
  );
}
