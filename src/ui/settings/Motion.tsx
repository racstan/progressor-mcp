// Settings › Motion: how much the page moves (motion.ts). Kept in this browser.
import { useState } from "react";
import { Choice } from "../Menus.js";
import { type Motion, applyMotion, readMotion, writeMotion } from "../motion.js";
import type { SettingsSection } from "./types.js";

function store(): Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  try {
    return localStorage;
  } catch {
    return { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };
  }
}

export function setMotion(motion: Motion): void {
  writeMotion(store(), motion);
  applyMotion(motion);
}

function MotionChoice() {
  const [motion, set] = useState<Motion>(() => readMotion(store()));
  return (
    <Choice value={motion} onChange={(m) => { setMotion(m); set(m); }}
      options={[
        { value: "full", label: "Full", hint: "Loading animations, pages gliding in, and spinners on buttons that are sending. The usual choice" },
        { value: "gentle", label: "Gentle", hint: "Only what says something is happening (dots, spinners, the step being worked on), slower; nothing shimmers or glides" },
        { value: "off", label: "Off", hint: "Nothing moves. A computer set to reduce motion always gets this" },
      ]} />
  );
}

export const motionSection: SettingsSection = { id: "motion", group: "look", title: "Motion", Component: MotionChoice, reset: () => setMotion("full") };
