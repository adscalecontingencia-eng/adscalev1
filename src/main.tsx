import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initThemeEarly } from "./hooks/useTheme";

initThemeEarly();

// If Supabase redirects back with a password-recovery code, force the hash route
// to /reset-password BEFORE HashRouter mounts so the default redirect to
// /marketplace doesn't swallow the recovery flow.
(() => {
  const params = new URLSearchParams(window.location.search);
  const hasResetMarker = params.get('reset') === '1' || params.has('code');
  const isRecoveryHash = window.location.hash.includes('type=recovery');
  if ((hasResetMarker || isRecoveryHash) && !window.location.hash.startsWith('#/reset-password')) {
    window.location.hash = '#/reset-password';
  }
})();

createRoot(document.getElementById("root")!).render(<App />);
