// The sections of Settings for how the page looks, kept in this browser: theme, pop-ups, finished
// goals, and Advanced (editor, things put off, running servers).
import { EDITORS } from "../../dashboard/editor.js";
import { Choice } from "../Menus.js";
import { ServersPanel } from "../Servers.js";
import type { SettingsContext, SettingsSection } from "./types.js";

const EDITOR_NAMES: Record<string, string> = {
  vscode: "VS Code",
  "vscode-insiders": "VS Code Insiders",
  vscodium: "VSCodium",
  cursor: "Cursor",
  windsurf: "Windsurf",
  zed: "Zed",
  jetbrains: "IntelliJ IDEA",
  idea: "IntelliJ IDEA",
  webstorm: "WebStorm",
  pycharm: "PyCharm",
  phpstorm: "PhpStorm",
  goland: "GoLand",
  rider: "Rider",
  rubymine: "RubyMine",
  clion: "CLion",
  rustrover: "RustRover",
};
/** The editor's name in words, for "Opening … in Cursor". */
export const editorName = (e: string) => EDITOR_NAMES[e] ?? (e.includes("{") ? "your editor" : e);

/** Whether this browser can show desktop pop-ups for the page, and whether it may. */
export const canPopUp = (): NotificationPermission | "unsupported" => ("Notification" in window ? Notification.permission : "unsupported");

function Theme({ ctx }: { ctx: SettingsContext }) {
  return (
    <Choice value={ctx.theme ?? "vibrant"} onChange={(t) => ctx.setTheme(t === "vibrant" ? undefined : t)}
      options={[
        { value: "vibrant", label: "Vibrant", hint: "Colourful, with black text: an indigo accent, green for done and amber for what needs you. The usual choice" },
        { value: "light", label: "Light", hint: "Black, white and greys only" },
        { value: "dark", label: "Dark", hint: "Always dark" },
        { value: "system", label: "System", hint: "Light or dark, following your computer's setting" },
      ]} />
  );
}

function PopUps({ ctx }: { ctx: SettingsContext }) {
  return (
    <label className="option">
      <input type="checkbox" checked={ctx.popUps === "on" && canPopUp() === "granted"} onChange={(e) => void ctx.switchPopUps(e.target.checked)} />
      <span><b>Pop up when a goal is finished</b><small>A desktop pop-up from any project, while a dashboard tab is open, even in the background.{canPopUp() === "denied" ? " Your browser blocks them for this page: allow notifications for this site in the browser's settings." : ""}</small></span>
    </label>
  );
}

function FinishedGoals({ ctx }: { ctx: SettingsContext }) {
  return (
    <>
      <label className="option">
        <input type="radio" name="finished" checked={ctx.finished !== "review"} onChange={() => ctx.setFinished(undefined)} />
        <span><b>Move to Finished straight away</b><small>Finished goals fold away as soon as they finish. The usual choice.</small></span>
      </label>
      <label className="option">
        <input type="radio" name="finished" checked={ctx.finished === "review"} onChange={() => ctx.setFinished("review")} />
        <span><b>Wait for me to look</b><small>A finished goal stays under Just finished until you open it.</small></span>
      </label>
    </>
  );
}

function TourChoice({ ctx }: { ctx: SettingsContext }) {
  return (
    <>
      <button className="btn small" onClick={ctx.takeTour}>Take the tour</button>
      <label className="option">
        <input type="checkbox" checked={ctx.tourOnOpen} onChange={(e) => ctx.setTourOnOpen(e.target.checked)} />
        <span><b>Show the tour when the page opens</b><small>A short walk past the main parts of the page, each time you open it, until you finish it or turn this off. It's also in ❓ Help.</small></span>
      </label>
    </>
  );
}

function Advanced({ ctx }: { ctx: SettingsContext }) {
  const { info, editor, putOff } = ctx;
  return (
    <>
      <section>
        <h3>Open files in</h3>
        <select className="picker" aria-label="Open files in" title="The code editor that opens when you click a file name on a step"
          value={editor} onChange={(e) => ctx.setEditorChoice(e.target.value === info?.editor ? undefined : e.target.value)}>
          {info?.editor && !EDITORS.includes(info.editor) && <option value={info.editor}>Custom (PROGRESSOR_EDITOR)</option>}
          {EDITORS.filter((e) => e !== "jetbrains").map((e) => (
            <option key={e} value={e}>{editorName(e)}</option>
          ))}
        </select>
      </section>
      <section>
        <h3>Things to try you put off</h3>
        <button className="btn ghost small" disabled={Object.keys(putOff).length === 0}
          onClick={() => {
            ctx.setPutOff({});
            ctx.toast("Everything you put off is back under Needs you.");
          }}>
          Bring them all back
        </button>
      </section>
      <ServersPanel servers={ctx.servers} hub={info} reload={ctx.reloadServers} toast={ctx.toast} />
    </>
  );
}

export const themeSection: SettingsSection = { id: "theme", group: "look", title: "Theme", Component: Theme, reset: (ctx) => ctx.setTheme(undefined) };
export const popUpsSection: SettingsSection = { id: "pop-ups", group: "notifications", title: "Pop-ups", Component: PopUps, reset: (ctx) => ctx.setPopUps(undefined) };
export const finishedSection: SettingsSection = { id: "finished", group: "look", title: "Finished goals", Component: FinishedGoals, reset: (ctx) => ctx.setFinished(undefined) };
export const tourSection: SettingsSection = { id: "tour", group: "look", title: "The tour", Component: TourChoice, reset: (ctx) => ctx.setTourOnOpen(false) };
export const advancedSection: SettingsSection = {
  id: "advanced",
  title: "Editor, servers and things put off",
  Component: Advanced,
  group: "advanced",
  reset: (ctx) => {
    ctx.setEditorChoice(undefined);
    ctx.setPutOff({});
  },
};
