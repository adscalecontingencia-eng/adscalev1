import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Row = {
  id: string;
  name: string;
  meta_account_id: string;
  last_sync_error_code: number | null;
  last_sync_error_message: string | null;
  last_sync_error_at: string | null;
  last_synced_at: string | null;
};

const fmt = (iso: string | null) =>
  iso ? format(new Date(iso), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—";

// Códigos de permissão retornados pela Meta durante o sync
const PERMISSION_CODES = [200, 190, 10, 100];

export default function AdsPermissionErrorsPanel({ refreshKey = 0 }: { refreshKey?: number }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("meta_ad_accounts")
        .select("id,name,meta_account_id,last_sync_error_code,last_sync_error_message,last_sync_error_at,last_synced_at")
        .in("last_sync_error_code", PERMISSION_CODES)
        .order("last_sync_error_at", { ascending: false })
        .limit(100);
      if (!cancelled && !error) setRows((data as any) || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [refreshKey]);

  if (loading || rows.length === 0) return null;

  return (
    <Card className="border-red-500/40 bg-red-500/5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 p-3 text-left"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-400" />
          <span className="text-sm font-medium text-red-200">
            Contas sem permissão na Meta ({rows.length})
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-red-300" /> : <ChevronDown className="h-4 w-4 text-red-300" />}
      </button>
      {open && (
        <div className="overflow-x-auto border-t border-red-500/20">
          <table className="w-full text-xs">
            <thead className="bg-red-500/10 text-red-200">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Conta</th>
                <th className="text-left px-3 py-2 font-medium">Código</th>
                <th className="text-left px-3 py-2 font-medium">Erro</th>
                <th className="text-left px-3 py-2 font-medium">Última sincronização</th>
                <th className="text-left px-3 py-2 font-medium">Erro em</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-red-500/10 hover:bg-red-500/5">
                  <td className="px-3 py-2 text-foreground">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-[10px] text-muted-foreground">{r.meta_account_id}</div>
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex px-1.5 py-0.5 rounded bg-red-500/20 text-red-200 font-mono">
                      {r.last_sync_error_code ?? "?"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground max-w-md">
                    <div className="line-clamp-2" title={r.last_sync_error_message || ""}>
                      {r.last_sync_error_message || "—"}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{fmt(r.last_synced_at)}</td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{fmt(r.last_sync_error_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-3 py-2 text-[10px] text-muted-foreground border-t border-red-500/20">
            Conceda "Ver desempenho" ou "Gerenciar campanhas" ao System User no Business Manager para restabelecer o sync.
          </div>
        </div>
      )}
    </Card>
  );
}
