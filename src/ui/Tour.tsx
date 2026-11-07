// The first-run tour (tourSteps.ts): a card that points at one part of the real page at a time, with
// Back, Next, Skip, a × and Don't show again (what each means for next time is in firstLook.ts). It never blocks the page: the dimming lets clicks through, Escape closes it,
// and focus goes back where it was when it ends.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Icon } from "./Icon.js";
import { TOUR_STEPS, type TourShow, firstTarget, tourMove } from "./tourSteps.js";

type Box = { top: number; left: number; width: number; height: number };

const PAD = 6;
const isPhone = () => matchMedia("(max-width: 640px)").matches;

/** How the tour ended: finished, Skip, × (or Escape), or with Don't show again ticked. */
export type TourEnd = "finish" | "skip" | "close" | "never";

export function Tour({ onClose, onShow }: { onClose: (how: TourEnd) => void; /** Shows the sample's page for a step. */ onShow: (show: TourShow) => void }) {
  const [never, setNever] = useState(false);
  const neverRef = useRef(false);
  neverRef.current = never;
  const end = (how: TourEnd) => onClose(neverRef.current ? "never" : how);
  const [at, setAt] = useState(0);
  const [box, setBox] = useState<Box>();
  const card = useRef<HTMLDivElement>(null);
  const before = useRef<Element | null>(null);
  const step = TOUR_STEPS[at]!;
  // the sample's page for this step, before the step measures where to point
  useLayoutEffect(() => onShow(step.show), [step, onShow]);
  // The highlight glides from one step's place to the next, but jumps while a step's place settles.
  const [glide, setGlide] = useState(false);
  const opened = useRef(false);
  useEffect(() => {
    if (!opened.current) {
      opened.current = true;
      return;
    }
    setGlide(true);
    const t = setTimeout(() => setGlide(false), 350);
    return () => clearTimeout(t);
  }, [at]);

  // Focus moves to the card, and back to where it was once the tour ends.
  useEffect(() => {
    before.current = document.activeElement;
    return () => (before.current as HTMLElement | null)?.focus?.();
  }, []);
  useEffect(() => card.current?.focus(), [at]);

  // Where the step points, measured again until the page settles (the sidebar may still be sliding in or
  // the plan still loading when a step opens), and whenever the page scrolls, resizes or finishes moving.
  useLayoutEffect(() => {
    let target: Element | null = null;
    const sizes = new ResizeObserver(() => place());
    const place = () => {
      const selector = firstTarget(step.targets, (s) => {
        const el = document.querySelector(s);
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
      });
      const el = selector ? document.querySelector(selector) : null;
      if (el !== target) {
        if (target) sizes.unobserve(target);
        if (el) sizes.observe(el);
        target = el;
      }
      if (!el) return setBox(undefined);
      const r = el.getBoundingClientRect();
      const top = Math.max(r.top, 0);
      const next = { top: top - PAD, left: r.left - PAD, width: r.width + 2 * PAD, height: Math.min(r.bottom, innerHeight) - top + 2 * PAD };
      setBox((b) => (b && b.top === next.top && b.left === next.left && b.width === next.width && b.height === next.height ? b : next));
    };
    place();
    // a few frames' worth of measuring while things slide and load
    const until = performance.now() + 800;
    let frame = requestAnimationFrame(function again() {
      place();
      if (performance.now() < until) frame = requestAnimationFrame(again);
    });
    // and once more whenever something on the page finishes moving, or the page itself changes size
    const settle = setTimeout(place, 900);
    sizes.observe(document.body);
    addEventListener("resize", place);
    addEventListener("scroll", place, true);
    document.addEventListener("transitionend", place, true);
    document.addEventListener("animationend", place, true);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(settle);
      sizes.disconnect();
      removeEventListener("resize", place);
      removeEventListener("scroll", place, true);
      document.removeEventListener("transitionend", place, true);
      document.removeEventListener("animationend", place, true);
    };
  }, [step]);

  const move = (how: "next" | "back" | "skip") => {
    const to = tourMove(at, how, TOUR_STEPS.length);
    if (to === undefined) end(how === "skip" ? "skip" : "finish");
    else setAt(to);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose(neverRef.current ? "never" : "close");
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [onClose]);

  // The card sits beside what it points at on a wide window (below it, or above when there is no room),
  // and at the bottom of the screen on a phone or when it points at nothing.
  const phone = isPhone();
  let place: React.CSSProperties | undefined;
  if (box && !phone) {
    const w = 340;
    const left = Math.min(Math.max(12, box.left + box.width + 12 > innerWidth - w ? box.left : box.left + box.width + 12), innerWidth - w - 12);
    const beside = box.left + box.width + 12 + w < innerWidth;
    const top = beside ? Math.min(Math.max(12, box.top), innerHeight - 260) : box.top + box.height + 12 + 230 < innerHeight ? box.top + box.height + 12 : Math.max(12, box.top - 242);
    place = { top, left, width: w };
  }
  const last = at === TOUR_STEPS.length - 1;
  return (
    <div className="tour" aria-live="polite">
      {box ? <div className={`tour-spot ${glide ? "glide" : ""}`} style={box} aria-hidden="true" /> : <div className="tour-dim" aria-hidden="true" />}
      <div ref={card} className={`tour-card ${place ? "" : "docked"}`} style={place} role="dialog" aria-modal="false" aria-labelledby="tour-title" aria-describedby="tour-body" tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") move("next");
          if (e.key === "ArrowLeft") move("back");
        }}>
        <button className="iconbtn tour-x" title="Close the tour" aria-label="Close the tour" onClick={() => end("close")}>
          <Icon name="close" size={16} />
        </button>
        <p className="tour-count">Step {at + 1} of {TOUR_STEPS.length}</p>
        <h2 id="tour-title">{step.title}</h2>
        {step.notice && (
          <p className="tour-notice" role="note">
            <strong>{step.notice}</strong>
          </p>
        )}
        <p id="tour-body">{step.body}</p>
        <label className="tour-never">
          <input type="checkbox" checked={never} onChange={(e) => setNever(e.target.checked)} />
          Don't show again
        </label>
        <div className="tour-actions">
          <button className="linkbtn" onClick={() => move("skip")}>Skip the tour</button>
          <span className="sp" />
          {at > 0 && <button className="btn ghost small" onClick={() => move("back")}>Back</button>}
          <button className="btn small" onClick={() => move("next")}>{last ? "Done" : "Next"}</button>
        </div>
      </div>
    </div>
  );
}
