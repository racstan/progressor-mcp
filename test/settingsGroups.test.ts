import { describe, expect, it } from "vitest";
import { SETTINGS_GROUPS, groupSections } from "../src/ui/settings/groups.js";
import { SETTINGS_SECTIONS } from "../src/ui/settings/index.js";

describe("the Settings page's sections", () => {
  it("puts every setting in exactly one group, in the groups' order", () => {
    const groups = groupSections(SETTINGS_SECTIONS);
    const ids = groups.flatMap((g) => g.sections.map((s) => s.id));
    expect(ids.sort()).toEqual(SETTINGS_SECTIONS.map((s) => s.id).sort());
    expect(groups.map((g) => g.id)).toEqual(SETTINGS_GROUPS.map((g) => g.id).filter((id) => groups.some((x) => x.id === id)));
  });

  it("starts with how the page looks and keeps Advanced for last among the settings", () => {
    const groups = groupSections(SETTINGS_SECTIONS);
    expect(groups[0]!.title).toBe("Look");
    expect(groups[0]!.sections.map((s) => s.id)).toContain("theme");
    expect(groups.find((g) => g.id === "notifications")!.sections.map((s) => s.id)).toEqual(["pop-ups", "phone"]);
    expect(groups.at(-1)!.id).toBe("advanced");
  });

  it("leaves out a group with no settings in it", () => {
    expect(groupSections([{ id: "a", group: "look" }]).map((g) => g.id)).toEqual(["look"]);
  });
});
