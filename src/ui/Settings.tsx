// The Settings panel: every section in the registry (settings/index.ts), each with "Reset this
// section", then Support, "Reset all settings to defaults", where settings are kept, and the free notice.
import { useState } from "react";
import { FreeNotice } from "./FreeNotice.js";
import { MenuPanel } from "./Menus.js";
import { resetAll } from "./settings/reset.js";
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

export function Settings({ ctx, onClose }: { ctx: SettingsContext; onClose: () => void }) {
  const [resetting, setResetting] = useState(false);
  const shown = SETTINGS_SECTIONS.filter((s) => !s.advanced);
  const advanced = SETTINGS_SECTIONS.filter((s) => s.advanced);
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
    <MenuPanel label="Settings" onClose={onClose}>
      {shown.map((s) => (
        <Section key={s.id} section={s} ctx={ctx} />
      ))}
      {advanced.length > 0 && (
        <details className="advanced">
          <summary title="Options for people who look at the code">Advanced</summary>
          {advanced.map((s) => (
            <div key={s.id} className="settings-section" data-section={s.id}>
              <s.Component ctx={ctx} />
              <div className="settings-foot">
                <ResetSection section={s} ctx={ctx} />
              </div>
            </div>
          ))}
        </details>
      )}
      <section>
        <h3>Support Progressor</h3>
        <a className="card" href={SUPPORT_URL} target="_blank" rel="noopener noreferrer">
          Buy me a coffee
          <small>Progressor is free for personal and noncommercial use. If it keeps you on track, a coffee keeps it going.</small>
        </a>
      </section>
      <section className="reset-all">
        <button className="btn ghost small" disabled={resetting} onClick={() => void resetEverything()}>
          {RESET_ALL}
        </button>
      </section>
      <p className="hint">{SETTINGS_WHERE}</p>
      <FreeNotice />
    </MenuPanel>
  );
}
