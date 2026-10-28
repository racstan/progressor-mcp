import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Where it sits: the whole page, or only the part that shows a goal (the sidebar stays usable). */
  scope: "page" | "goal";
}

/**
 * Catches a part of the page that fails to draw, so the person sees a plain message instead of a
 * blank page. Around the goal panel it is keyed by what is shown, so picking another goal or project
 * tries again by itself.
 */
export class ErrorBoundary extends Component<Props, { error?: Error }> {
  state: { error?: Error } = {};

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("progressor dashboard:", error);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="placeholder" role="alert">
        <h2>Something on this page could not be shown</h2>
        {this.props.scope === "goal"
          ? "Your plan is safe; only this view failed. Pick another goal or project, or reload the page."
          : "Your plan is safe; only the page failed. Reload it to try again."}
        <div><button type="button" className="chip" onClick={() => location.reload()}>Reload the page</button></div>
        <small className="detail">{error.message}</small>
      </div>
    );
  }
}
