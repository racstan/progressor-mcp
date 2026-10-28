import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { ErrorBoundary } from "./ErrorBoundary.js";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary scope="page">
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
