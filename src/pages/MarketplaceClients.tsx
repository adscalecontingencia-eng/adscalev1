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
  created_at: string;
  balance: number;
  total_deposited: number;
  total_spent: number;
}

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

export default function MarketplaceClients() {
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    // We have wallets + wallet_deposits + wallet_transactions accessible via RLS for admin.
    // Use marketplace_orders as join to find marketplace users, plus wallets to enrich.
    const [{ data: wallets }, { data: deposits }, { data: txs }] = await Promise.all([
      supabase.from("wallets").select("user_id,balance,created_at"),
      supabase.from("wallet_deposits").select("user_id,amount,status,customer_email,customer_name"),
      supabase.from("wallet_transactions").select("user_id,type,amount"),
    ]);

    const map = new Map<string, Row>();
    (wallets ?? []).forEach((w: any) => {
      map.set(w.user_id, {
        user_id: w.user_id,
        email: "",
        name: "",
        created_at: w.created_at,
        balance: Number(w.balance || 0),
        total_deposited: 0,
        total_spent: 0,
      });
    });
    (deposits ?? []).forEach((d: any) => {
      const r = map.get(d.user_id) ?? {
        user_id: d.user_id, email: "", name: "", created_at: "",
        balance: 0, total_deposited: 0, total_spent: 0,
      };
      if (d.customer_email && !r.email) r.email = d.customer_email;
      if (d.customer_name && !r.name) r.name = d.customer_name;
      if (d.status === "approved") r.total_deposited += Number(d.amount || 0);
      map.set(d.user_id, r);
    });
    (txs ?? []).forEach((t: any) => {
      const r = map.get(t.user_id);
      if (!r) return;
      if (t.type === "purchase") r.total_spent += Math.abs(Number(t.amount || 0));
    });

    setRows(Array.from(map.values()).sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")));
    setLoading(false);
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
            <UsersRound size={22} /> Clientes do Marketplace
          </h1>
          <p className="text-sm text-muted-foreground">Usuários cadastrados via marketplace, com saldo e histórico.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw size={14} className={`mr-1.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Clientes" value={totals.users.toLocaleString("pt-BR")} />
        <StatCard label="Total Depositado" value={fmtBRL(totals.deposited)} />
        <StatCard label="Total Gasto" value={fmtBRL(totals.spent)} />
        <StatCard label="Saldo em Carteira" value={fmtBRL(totals.balance)} />
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
        <div className="relative max-w-md mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por email, nome ou ID…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Cadastro</TableHead>
                <TableHead className="text-right">Depositado</TableHead>
                <TableHead className="text-right">Gasto</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Status</TableHead>
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
                    {r.created_at ? new Date(r.created_at).toLocaleDateString("pt-BR") : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmtBRL(r.total_deposited)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtBRL(r.total_spent)}</TableCell>
                  <TableCell className="text-right tabular-nums text-emerald-400 font-semibold">{fmtBRL(r.balance)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={r.total_deposited > 0 ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10" : "border-border text-muted-foreground"}>
                      {r.total_deposited > 0 ? "Ativo" : "Novo"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && !loading && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">Nenhum cliente encontrado.</TableCell></TableRow>
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
