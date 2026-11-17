// Every section of the Settings page, in the order shown. A feature adds its section in
// src/ui/settings/<Feature>.tsx and one line here (with its group, groups.ts); Settings.tsx shows it with "Reset this section",
// and "Reset all settings to defaults" resets it too.
import { advancedSection, finishedSection, popUpsSection, themeSection, tourSection } from "./Look.js";
import { motionSection } from "./Motion.js";
import { phoneSection } from "./Phone.js";
import { estimatesSection } from "./Estimates.js";
import { evidenceSection } from "./Evidence.js";
import { dependenciesSection } from "./Dependencies.js";
import { checkupSection } from "./Checkup.js";
import { historySection } from "./History.js";
import { releaseSection } from "./Release.js";
import { handoffsSection } from "./Handoffs.js";
import { alternativesSection } from "./Alternatives.js";
import { routinesSection } from "./Routines.js";
import { backgroundSection } from "./Background.js";
import { claimsSection } from "./Claims.js";
import { costSection } from "./Cost.js";
import { checksSection, homePageSection } from "./Home.js";
import type { SettingsSection } from "./types.js";

export type { SettingsContext, SettingsSection, Theme } from "./types.js";

export const SETTINGS_SECTIONS: SettingsSection[] = [
  themeSection,
  motionSection,
  popUpsSection,
  homePageSection,
  finishedSection,
  tourSection,
  // Features' sections go here, one line each.
  phoneSection,
  estimatesSection,
  evidenceSection,
  dependenciesSection,
  checkupSection,
  historySection,
  releaseSection,
  handoffsSection,
  routinesSection,
  alternativesSection,
  claimsSection,
  costSection,
  checksSection,
  backgroundSection,
  advancedSection,
];
