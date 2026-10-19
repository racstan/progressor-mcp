import { describe, expect, it } from "vitest";
import { LANE_Y, STEP_X, chooseWrap, edgePath, positionOf } from "../src/ui/geometry.js";

const screen = { width: 1200, height: 750 };
const at = (step: number, lane = 0, wrap = chooseWrap(45, 1, screen)) => positionOf({ step, lane }, "horizontal", wrap);

describe("wrapping a long plan into rows", () => {
  it("keeps a short plan on one line", () => {
    expect(chooseWrap(5, 1, screen).columns).toBe(5);
  });

  it("wraps a long plan into rows so the whole plan fits at a readable size", () => {
    const wrap = chooseWrap(45, 1, screen);
    expect(wrap.columns).toBeGreaterThan(3);
    expect(wrap.columns).toBeLessThan(45);
    const rows = Math.ceil(45 / wrap.columns);
    const scale = Math.min((screen.width - 80) / (wrap.columns * STEP_X), (screen.height - 100) / (rows * wrap.rowHeight));
    expect(scale).toBeGreaterThan(0.6);
  });

  it("leaves room in each row for the Detour lanes below the line", () => {
    expect(chooseWrap(45, 3, screen).rowHeight).toBeGreaterThan(chooseWrap(45, 1, screen).rowHeight + LANE_Y);
  });

  it("runs every other row back the other way, like a snake", () => {
    const { columns, rowHeight } = chooseWrap(45, 1, screen);
    expect(at(0)).toEqual({ x: 0, y: 0 });
    expect(at(columns - 1)).toEqual({ x: (columns - 1) * STEP_X, y: 0 });
    // the next stop sits right below the end of the first row, and the row runs leftwards
    expect(at(columns)).toEqual({ x: (columns - 1) * STEP_X, y: rowHeight });
    expect(at(columns + 1).x).toBe((columns - 2) * STEP_X);
    expect(at(2 * columns)).toEqual({ x: 0, y: 2 * rowHeight });
  });

  it("puts a Detour's lane below its row", () => {
    const wrap = chooseWrap(45, 2, screen);
    expect(at(wrap.columns + 1, 1, wrap).y).toBe(wrap.rowHeight + LANE_Y);
  });

  it("turns the line round the end of a row instead of cutting across", () => {
    const wrap = chooseWrap(45, 1, screen);
    const end = at(wrap.columns - 1, 0, wrap);
    const next = at(wrap.columns, 0, wrap);
    const xs = edgePath(end, next, "plan", "horizontal", wrap).match(/-?\d+(\.\d+)?/g)!.map(Number).filter((_, i) => i % 2 === 0);
    expect(Math.max(...xs)).toBeGreaterThan(end.x + 30);
  });

  it("loops a merge back the right way on a row that runs leftwards", () => {
    const wrap = chooseWrap(45, 2, screen);
    const from = at(wrap.columns + 2, 1, wrap);
    const forward = at(wrap.columns + 3, 0, wrap);
    // rejoining further along the row is a plain curve, not a loop back
    expect(edgePath(from, forward, "merge", "horizontal", wrap)).toBe(edgePath(from, forward, "plan", "horizontal", wrap));
  });

  it("leaves the map unwrapped without a wrap", () => {
    expect(positionOf({ step: 30, lane: 1 }, "horizontal")).toEqual({ x: 30 * STEP_X, y: LANE_Y });
  });
});
