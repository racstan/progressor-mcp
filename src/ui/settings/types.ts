// What every section of the Settings page gets (Settings.tsx), and what a section is.
import type { ReactNode } from "react";
import type { InfoView, ServersView, SettingsView } from "../data.js";
import type { Finished } from "../goalList.js";
import type { PutOff } from "../home.js";
import type { SettingsGroupId } from "./groups.js";

export type Theme = "light" | "dark" | "system" | "vibrant";

export interface SettingsContext {
  // How the page looks, kept in this browser.
  theme: Theme | undefined;
  setTheme(t: Theme | undefined): void;
  popUps: "on" | undefined;
  /** Turns desktop pop-ups on (asking the browser first) or off. */
  switchPopUps(on: boolean): void | Promise<void>;
  setPopUps(v: "on" | undefined): void;
  finished: Finished | undefined;
  setFinished(f: Finished | undefined): void;
  /** The editor files open in: the person's choice, else the server's, else the default. */
  editor: string;
  info: InfoView | undefined;
  setEditorChoice(e: string | undefined): void;
  putOff: PutOff;
  setPutOff(p: PutOff): void;
  servers: ServersView | "unsupported" | undefined;
  reloadServers(): void;
  toast(text: string): void;
  // How Progressor works, kept on this computer (settings.ts).
  /** The settings in effect for the project shown; null when the dashboard's server is too old to have them. */
  computer: SettingsView | null | undefined;
  /** The project shown, if any. */
  projectId: string | undefined;
  /** Changes one section for every project, or with `forProject` for the project shown only. */
  save(section: string, values: Record<string, unknown>, forProject?: boolean): Promise<void>;
  /** Puts one section, or every one when none is named, back to its defaults on this computer. */
  resetComputer(section?: string): Promise<void>;
}

/** One section of the Settings page. A feature adds its own in src/ui/settings/<Feature>.tsx and one line in index.ts. */
export interface SettingsSection {
  id: string;
  title: string;
  Component: (props: { ctx: SettingsContext }) => ReactNode;
  /** Puts this section back to its defaults. */
  reset(ctx: SettingsContext): void | Promise<void>;
  /** The group of the Settings page it is shown in (groups.ts). */
  group: SettingsGroupId;
}
