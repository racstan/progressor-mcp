// The sections of Settings for how the page looks, kept in this browser: theme, pop-ups, finished
// goals, and Advanced (editor, running servers).
import { EDITORS } from "../../dashboard/editor.js";
import { Choice } from "../Menus.js";
import { clearStored, useStored } from "../data.js";
import {
  FINISHED_SORT_DEFAULT, FINISHED_SORT_KEY, FINISHED_SORT_WORDS, type FinishedSort, GROUP_BY_DEFAULT, GROUP_BY_KEY, GROUP_BY_WORDS, type GroupBy,
  STEPS_VIEW_DEFAULT, STEPS_VIEW_KEY, type StepsView, isFinishedSort, isGroupBy, isStepsView,
} from "../goalList.js";
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
      <FinishedOrder />
    </>
  );
}

const STEPS_VIEW_WORDS: Record<StepsView, string> = {
  plan: "In plan order",
  newest: "By day finished, newest first",
  oldest: "By day finished, oldest first",
};

/** The order and day groups of the Finished list and of a goal's steps; the same choices as the Sort link in the sidebar. */
function FinishedOrder() {
  const [sort, setSort] = useStored<FinishedSort>(FINISHED_SORT_KEY, undefined);
  const [group, setGroup] = useStored<GroupBy>(GROUP_BY_KEY, undefined);
  const [steps, setSteps] = useStored<StepsView>(STEPS_VIEW_KEY, undefined);
  const pick = <T extends string>(set: (v: T | undefined) => void, usual: T) => (v: T) => set(v === usual ? undefined : v);
  return (
    <div className="limits">
      <label className="limit">
        <span>Order finished goals</span>
        <select className="picker" value={isFinishedSort(sort) ? sort : FINISHED_SORT_DEFAULT} onChange={(e) => pick(setSort, FINISHED_SORT_DEFAULT)(e.target.value as FinishedSort)}>
          {Object.entries(FINISHED_SORT_WORDS).map(([v, w]) => <option key={v} value={v}>{w}</option>)}
        </select>
      </label>
      <label className="limit">
        <span>Group finished goals</span>
        <select className="picker" value={isGroupBy(group) ? group : GROUP_BY_DEFAULT} onChange={(e) => pick(setGroup, GROUP_BY_DEFAULT)(e.target.value as GroupBy)}>
          {Object.entries(GROUP_BY_WORDS).map(([v, w]) => <option key={v} value={v}>{w}</option>)}
        </select>
      </label>
      <label className="limit">
        <span>Show a goal's steps</span>
        <select className="picker" value={isStepsView(steps) ? steps : STEPS_VIEW_DEFAULT} onChange={(e) => pick(setSteps, STEPS_VIEW_DEFAULT)(e.target.value as StepsView)}>
          {Object.entries(STEPS_VIEW_WORDS).map(([v, w]) => <option key={v} value={v}>{w}</option>)}
        </select>
      </label>
    </div>
  );
}

const resetFinishedOrder = () => [FINISHED_SORT_KEY, GROUP_BY_KEY, STEPS_VIEW_KEY].forEach(clearStored);

function TourChoice({ ctx }: { ctx: SettingsContext }) {
  return (
    <>
      <button className="btn small" onClick={ctx.takeTour}>Take the walkthrough</button>
      <label className="option">
        <input type="checkbox" checked={ctx.tourOnOpen} onChange={(e) => ctx.setTourOnOpen(e.target.checked)} />
        <span><b>Show the walkthrough when the page opens</b><small>A short walk past the main parts of the page, each time you open it, until you finish it or turn this off. It's also in ❓ Help.</small></span>
      </label>
    </>
  );
}

function Advanced({ ctx }: { ctx: SettingsContext }) {
  const { info, editor } = ctx;
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
      <ServersPanel servers={ctx.servers} hub={info} reload={ctx.reloadServers} toast={ctx.toast} />
    </>
  );
}

export const themeSection: SettingsSection = { id: "theme", group: "look", title: "Theme", Component: Theme, reset: (ctx) => ctx.setTheme(undefined) };
export const popUpsSection: SettingsSection = { id: "pop-ups", group: "notifications", title: "Pop-ups", Component: PopUps, reset: (ctx) => ctx.setPopUps(undefined) };
export const finishedSection: SettingsSection = {
  id: "finished",
  group: "look",
  title: "Finished goals and steps",
  Component: FinishedGoals,
  reset: (ctx) => {
    ctx.setFinished(undefined);
    resetFinishedOrder();
  },
};
export const tourSection: SettingsSection = { id: "tour", group: "look", title: "The walkthrough", Component: TourChoice, reset: (ctx) => ctx.setTourOnOpen(false) };
export const advancedSection: SettingsSection = {
  id: "advanced",
  title: "Editor and servers",
  Component: Advanced,
  group: "advanced",
  reset: (ctx) => {
    ctx.setEditorChoice(undefined);
  },
};
