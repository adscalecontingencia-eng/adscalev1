import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initThemeEarly } from "./hooks/useTheme";
import { installSystemErrorLogger } from "./lib/system-error-logger";

initThemeEarly();
installSystemErrorLogger();

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

  // Decode the GitHub Pages SPA 404 hack: /404.html rewrites /foo → /?/foo
  // Restore the original path into the hash before HashRouter mounts.
  const search = window.location.search;
  if (search.startsWith('?/')) {
    const decoded = search.slice(1).split('&').map((s, i) =>
      i === 0 ? s.replace(/~and~/g, '&') : s
    );
    const restoredPath = decoded[0]; // begins with "/"
    const restoredSearch = decoded.length > 1 ? '?' + decoded.slice(1).join('&') : '';
    window.history.replaceState(
      null, '',
      window.location.pathname.replace(/\/+$/, '') + '/' + restoredSearch + '#' + restoredPath + (window.location.hash || '')
    );
  }

  // SPA path → hash redirect (HashRouter): if the user lands on /some-path with no hash,
  // forward to /#/some-path so the route resolves correctly.
  const path = window.location.pathname.replace(/\/+$/, '');
  const base = (import.meta as any).env?.BASE_URL?.replace(/\/+$/, '') ?? '';
  const rel = base && path.startsWith(base) ? path.slice(base.length) : path;
  if (rel && rel !== '/' && !window.location.hash) {
    window.location.replace(`${base || ''}/#${rel}${window.location.search}`);
  }
})();

createRoot(document.getElementById("root")!).render(<App />);
