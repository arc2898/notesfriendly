import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Service-worker registration guard: NEVER register inside the Lovable editor
// preview (iframe / preview hostnames). Stale SWs there break HMR & routing.
const isInIframe = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();
const host = window.location.hostname;
const isPreviewHost =
  host.includes("id-preview--") ||
  host.includes("lovableproject.com") ||
  host === "localhost" ||
  host === "127.0.0.1";

if (isInIframe || isPreviewHost) {
  navigator.serviceWorker?.getRegistrations().then((regs) => {
    regs.forEach((r) => r.unregister());
  });
} else if ("serviceWorker" in navigator) {
  // Production only — vite-plugin-pwa autoUpdate handles registration via virtual module.
  import("virtual:pwa-register").then(({ registerSW }) => {
    registerSW({ immediate: true });
  }).catch(() => { /* ignore in dev */ });
}

createRoot(document.getElementById("root")!).render(<App />);
