import { useEffect, useState } from "react";
import { tr } from '@/i18n';
import { getNumberLocale } from '@/i18n/format';
import { Link } from "react-router-dom";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type App = { id: string; label: string; token_expires_at: string | null; status: string };

const WARN_DAYS = 10;
const DAY = 86_400_000;

export default function TokenExpiryBanner() {
  const [apps, setApps] = useState<App[]>([]);

  useEffect(() => {
    supabase
      .from("meta_apps")
      .select("id,label,token_expires_at,status")
      .then(({ data }) => setApps((data as App[]) || []));
  }, []);

  const items = apps
    .filter((a) => a.status !== "inactive" && a.token_expires_at)
    .map((a) => ({ ...a, days: Math.ceil((new Date(a.token_expires_at!).getTime() - Date.now()) / DAY) }))
    .filter((a) => a.days <= WARN_DAYS)
    .sort((a, b) => a.days - b.days);

  if (!items.length) return null;
  const anyExpired = items.some((a) => a.days <= 0);

  return (
    <div
      className={`rounded-lg border p-4 flex flex-col gap-2 ${
        anyExpired ? "border-destructive/60 bg-destructive/10" : "border-yellow-500/50 bg-yellow-500/10"
      }`}
    >
      <div className="flex items-center gap-2 font-semibold text-foreground">
        <AlertTriangle className={`h-5 w-5 ${anyExpired ? "text-destructive" : "text-yellow-500"}`} />
        {anyExpired ? tr('meta.token.expired') : tr('meta.token.expiring')}
      </div>
      <ul className="text-sm text-muted-foreground space-y-0.5">
        {items.map((a) => (
          <li key={a.id}>
            <span className="text-foreground font-medium">{a.label}</span>{" "}
            {a.days <= 0
              ? tr('meta.token.expiredOn', { date: new Date(a.token_expires_at!).toLocaleDateString(getNumberLocale()) })
              : tr('meta.token.expiresIn', { count: a.days, date: new Date(a.token_expires_at!).toLocaleDateString(getNumberLocale()) })}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-3 text-sm">
        <a
          href="https://developers.facebook.com/tools/explorer"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
        >
          {tr('meta.token.newToken')} <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <a
          href="https://developers.facebook.com/tools/debug/accesstoken"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          {tr('meta.token.extend')} <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <Link to="/meta-apps" className="text-primary hover:underline">
          {tr('meta.token.paste')}
        </Link>
      </div>
    </div>
  );
}
