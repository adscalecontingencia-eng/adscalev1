import { getNumberLocale } from "@/i18n/format";
import { tr } from '@/i18n';
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, RefreshCw, UsersRound } from "lucide-react";

interface Row {
  user_id: string;
  email: string;
  name: string;
  phone?: string;
  created_at: string;
  balance: number;
  total_deposited: number;
  total_spent: number;
}

const fmtBRL = (n: number) =>
  new Intl.NumberFormat(getNumberLocale(), { style: "currency", currency: "BRL" }).format(n || 0);

export default function MarketplaceClients() {
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("list-marketplace-clients", { body: {} });
      if (error) throw error;
      const r = (data as any)?.rows ?? [];
      setRows(r);
    } catch (e: any) {
      setError(e?.message || tr('amk.loadErr'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(r => r.email.toLowerCase().includes(q) || r.name.toLowerCase().includes(q) || r.user_id.includes(q));
  }, [rows, search]);

  const totals = useMemo(() => ({
    users: rows.length,
    deposited: rows.reduce((s, r) => s + r.total_deposited, 0),
    spent: rows.reduce((s, r) => s + r.total_spent, 0),
    balance: rows.reduce((s, r) => s + r.balance, 0),
  }), [rows]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <UsersRound size={22} /> {tr('amk.clientsTitle')}
          </h1>
          <p className="text-sm text-muted-foreground">{tr('amk.clientsDesc')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw size={14} className={`mr-1.5 ${loading ? "animate-spin" : ""}`} /> {tr('amk.refresh')}
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}


      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label={tr('amk.clients')} value={totals.users.toLocaleString(getNumberLocale())} />
        <StatCard label={tr('amk.totalDeposited')} value={fmtBRL(totals.deposited)} />
        <StatCard label={tr('amk.totalSpent')} value={fmtBRL(totals.spent)} />
        <StatCard label={tr('amk.walletBalance')} value={fmtBRL(totals.balance)} />
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
        <div className="relative max-w-md mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder={tr('amk.searchPh')} value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tr('amk.client')}</TableHead>
                <TableHead>{tr('amk.signupCol')}</TableHead>
                <TableHead className="text-right">{tr('amk.deposited')}</TableHead>
                <TableHead className="text-right">{tr('amk.spent')}</TableHead>
                <TableHead className="text-right">{tr('amk.balance')}</TableHead>
                <TableHead>{tr('amk.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(r => (
                <TableRow key={r.user_id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{r.name || "—"}</span>
                      <span className="text-xs text-muted-foreground">{r.email || r.user_id.slice(0, 12)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.created_at ? new Date(r.created_at).toLocaleDateString(getNumberLocale()) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmtBRL(r.total_deposited)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtBRL(r.total_spent)}</TableCell>
                  <TableCell className="text-right tabular-nums text-emerald-400 font-semibold">{fmtBRL(r.balance)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={r.total_deposited > 0 ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10" : "border-border text-muted-foreground"}>
                      {r.total_deposited > 0 ? tr('amk.active') : tr('amk.new')}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && !loading && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">{tr('amk.noClients')}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

const StatCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-xl border border-border/60 bg-card/60 p-4">
    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
    <p className="font-display text-xl font-bold text-foreground mt-1">{value}</p>
  </div>
);
