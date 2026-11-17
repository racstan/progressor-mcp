import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { ErrorBoundary } from "./ErrorBoundary.js";
import { applyMotion, readMotion } from "./motion.js";
import { installWriteToken } from "./writeToken.js";

installWriteToken();
try {
  applyMotion(readMotion(localStorage));
} catch {
  // no storage: full motion
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary scope="page">
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
