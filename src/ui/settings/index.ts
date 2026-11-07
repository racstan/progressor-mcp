// Every section of the Settings panel, in the order shown. A feature adds its section in
// src/ui/settings/<Feature>.tsx and one line here; Settings.tsx shows it with "Reset this section",
// and "Reset all settings to defaults" resets it too.
import { advancedSection, finishedSection, popUpsSection, themeSection } from "./Look.js";
import { phoneSection } from "./Phone.js";
import { estimatesSection } from "./Estimates.js";
import { evidenceSection } from "./Evidence.js";
import { dependenciesSection } from "./Dependencies.js";
import { historySection } from "./History.js";
import { alternativesSection } from "./Alternatives.js";
import type { SettingsSection } from "./types.js";

export type { SettingsContext, SettingsSection, Theme } from "./types.js";

export const SETTINGS_SECTIONS: SettingsSection[] = [
  themeSection,
  popUpsSection,
  finishedSection,
  // Features' sections go here, one line each.
  phoneSection,
  estimatesSection,
  evidenceSection,
  dependenciesSection,
  historySection,
  alternativesSection,
  advancedSection,
];
