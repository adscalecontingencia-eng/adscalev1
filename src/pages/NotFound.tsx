import { useLocation, Link } from "react-router-dom";
import { useEffect, useState } from "react";

// Rotas conhecidas do app — usadas para recuperar links antigos/sem hash
// (ex.: https://dominio.com/client-dashboard) que caíam em 404.
const KNOWN_ROUTES = [
  "client-dashboard",
  "partner-dashboard",
  "dashboard",
  "login",
  "marketplace",
  "perfil",
  "clients",
  "financial",
  "support",
];

const NotFound = () => {
  const location = useLocation();
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    const raw = location.pathname.replace(/^\/+/, "").replace(/\/+$/, "");
    const first = raw.split("/")[0];

    // Aliases antigos do painel do cliente
    const aliases: Record<string, string> = {
      "dashboard-cliente": "client-dashboard",
      "painel": "client-dashboard",
      "painel-cliente": "client-dashboard",
      "cliente": "client-dashboard",
      "client": "client-dashboard",
    };

    if (aliases[first]) {
      setRecovering(true);
      window.location.replace(`${window.location.pathname.split("#")[0]}#/${aliases[first]}`);
      return;
    }

    // Se o caminho existe no app mas veio fora do hash (link direto no servidor),
    // reencaminha para a rota correta em vez de mostrar 404.
    if (first && KNOWN_ROUTES.includes(first) && !window.location.hash.includes(`/${first}`)) {
      setRecovering(true);
      window.location.replace(`/#/${raw}${window.location.search}`);
      return;
    }

    console.error("404: rota inexistente:", location.pathname);
  }, [location.pathname]);

  if (recovering) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Redirecionando…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center px-6">
        <h1 className="mb-3 text-4xl font-bold text-foreground">404</h1>
        <p className="mb-6 text-lg text-muted-foreground">Página não encontrada</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/client-dashboard"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Painel do cliente
          </Link>
          <Link
            to="/login"
            className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary"
          >
            Entrar
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
