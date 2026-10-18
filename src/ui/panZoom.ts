// Zoom (wheel, buttons, keys) and pan (drag the background) for an <svg> whose content sits in a <g>.
import type { Point } from "./geometry.js";

export interface View {
  s: number;
  tx: number;
  ty: number;
  fitted: boolean;
}

export interface PanZoom {
  scale: () => number;
  zoomBy: (k: number) => void;
  /** Fits the whole map. With `focus`, keeps a readable scale and centres that point instead when the map is large. */
  fit: (focus?: Point) => void;
  destroy: () => void;
}

const MIN = 0.2;
const MAX = 3;

/**
 * `wheel`: "zoom" zooms with the mouse wheel; "scroll" moves the map with it (for a long map that
 * runs down the page) and zooms only with Ctrl or a trackpad pinch.
 */
export function panZoom(svg: SVGSVGElement, content: SVGGElement, view: View, wheelMode: "zoom" | "scroll" = "zoom"): PanZoom {
  const apply = () => content.setAttribute("transform", `translate(${view.tx},${view.ty}) scale(${view.s})`);
  const zoomAt = (k: number, mx: number, my: number) => {
    const s = Math.min(MAX, Math.max(MIN, view.s * k));
    view.tx = mx - ((mx - view.tx) * s) / view.s;
    view.ty = my - ((my - view.ty) * s) / view.s;
    view.s = s;
    apply();
  };
  const centre = () => {
    const r = svg.getBoundingClientRect();
    return [r.width / 2, r.height / 2] as const;
  };

  const wheel = (e: WheelEvent) => {
    e.preventDefault();
    const r = svg.getBoundingClientRect();
    if (wheelMode === "scroll" && !e.ctrlKey && !e.metaKey) {
      view.tx -= e.shiftKey ? e.deltaY : e.deltaX;
      view.ty -= e.shiftKey ? 0 : e.deltaY;
      apply();
      return;
    }
    zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
  };
  let pan: { x: number; y: number; tx: number; ty: number; id: number } | undefined;
  const down = (e: PointerEvent) => {
    if (e.button !== 0 || (e.target as Element).closest("[data-node]")) return;
    pan = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty, id: e.pointerId };
    svg.setPointerCapture(e.pointerId);
    svg.classList.add("panning");
  };
  const move = (e: PointerEvent) => {
    if (!pan || e.pointerId !== pan.id) return;
    view.tx = pan.tx + e.clientX - pan.x;
    view.ty = pan.ty + e.clientY - pan.y;
    apply();
  };
  const up = () => {
    pan = undefined;
    svg.classList.remove("panning");
  };

  svg.addEventListener("wheel", wheel, { passive: false });
  svg.addEventListener("pointerdown", down);
  svg.addEventListener("pointermove", move);
  svg.addEventListener("pointerup", up);
  svg.addEventListener("pointercancel", up);
  apply();

  const fit = (focus?: Point) => {
    const b = content.getBBox();
    const r = svg.getBoundingClientRect();
    if (!b.width || !r.width || !r.height) return;
    const s = Math.min(1.4, (r.width - 80) / b.width, (r.height - 100) / b.height);
    view.s = Math.max(MIN, focus ? Math.max(0.6, s) : s);
    view.tx = (r.width - b.width * view.s) / 2 - b.x * view.s;
    view.ty = (r.height - b.height * view.s) / 2 - b.y * view.s;
    if (focus && view.s > s) {
      view.tx = r.width / 2 - focus.x * view.s;
      view.ty = r.height / 2 - focus.y * view.s;
    }
    view.fitted = true;
    apply();
  };

  return {
    scale: () => view.s,
    zoomBy: (k) => zoomAt(k, ...centre()),
    fit,
    destroy: () => {
      svg.removeEventListener("wheel", wheel);
      svg.removeEventListener("pointerdown", down);
      svg.removeEventListener("pointermove", move);
      svg.removeEventListener("pointerup", up);
      svg.removeEventListener("pointercancel", up);
    },
  };
}
