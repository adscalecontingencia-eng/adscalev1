import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { RefreshCw, Search, Link2, Unlink, Building2 } from "lucide-react";

type BM = { id: string; meta_bm_id: string; name: string; status: string | null; last_synced_at: string | null };
type Account = {
  id: string;
  meta_account_id: string;
  bm_id: string | null;
  name: string;
  status: string | null;
  account_status: number | null;
  currency: string | null;
  amount_spent: number | null;
};
type Assignment = { ad_account_id: string; client_id: string; active: boolean };
type Client = { id: string; name: string; email: string };

export default function MetaConnections() {
  const [bms, setBms] = useState<BM[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<"bms" | "accounts" | null>(null);
  const [filterBm, setFilterBm] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    const [b, a, asn, cl] = await Promise.all([
      supabase.from("meta_business_managers").select("*").order("name"),
      supabase.from("meta_ad_accounts").select("*").order("name"),
      supabase.from("meta_ad_account_assignments").select("ad_account_id, client_id, active").eq("active", true),
      supabase.from("clients").select("id, name, email").order("name"),
    ]);
    setBms((b.data as BM[]) || []);
    setAccounts((a.data as Account[]) || []);
    setAssignments((asn.data as Assignment[]) || []);
    setClients((cl.data as Client[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const sync = async (action: "sync_bms" | "sync_accounts") => {
    setSyncing(action === "sync_bms" ? "bms" : "accounts");
    try {
      const { data, error } = await supabase.functions.invoke("meta-sync", { body: { action } });
      if (error) throw error;
      if ((data as any)?.erro) throw new Error((data as any).erro);
      toast.success(
        action === "sync_bms"
          ? `${(data as any).bms_sincronizadas} BMs sincronizadas`
          : `${(data as any).contas_sincronizadas} contas sincronizadas`
      );
      await load();
    } catch (e: any) {
      toast.error(`Erro na sincronização: ${e.message}`);
    } finally {
      setSyncing(null);
    }
  };

  const assign = async (ad_account_id: string, client_id: string | null) => {
    try {
      const action = client_id ? "assign" : "unassign";
      const { data, error } = await supabase.functions.invoke("meta-assign-account", {
        body: { action, ad_account_id, client_id },
      });
      if (error) throw error;
      if ((data as any)?.erro) throw new Error((data as any).erro);
      toast.success(client_id ? "Conta atribuída" : "Atribuição removida");
      await load();
    } catch (e: any) {
      toast.error(`Falha: ${e.message}`);
    }
  };

  const bmName = useMemo(() => {
    const m = new Map(bms.map((b) => [b.id, b.name]));
    return (id: string | null) => (id ? m.get(id) || "—" : "—");
  }, [bms]);

  const currentClient = useMemo(() => {
    const m = new Map(assignments.map((a) => [a.ad_account_id, a.client_id]));
    return (accId: string) => m.get(accId) || null;
  }, [assignments]);

  const filtered = useMemo(() => {
    return accounts.filter((a) => {
      if (filterBm !== "all" && a.bm_id !== filterBm) return false;
      if (filterStatus === "active" && a.status !== "active") return false;
      if (filterStatus === "blocked" && a.status === "active") return false;
      if (filterStatus === "assigned" && !currentClient(a.id)) return false;
      if (filterStatus === "unassigned" && currentClient(a.id)) return false;
      if (search && !`${a.name} ${a.meta_account_id}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [accounts, filterBm, filterStatus, search, currentClient]);

  const stats = useMemo(() => ({
    bms: bms.length,
    accounts: accounts.length,
    assigned: assignments.length,
    blocked: accounts.filter((a) => a.status !== "active").length,
  }), [bms, accounts, assignments]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">Conexões Meta</h2>
          <p className="text-sm text-muted-foreground">
            Business Managers e contas de anúncio sincronizadas via API.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={!!syncing} onClick={() => sync("sync_bms")}>
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing === "bms" ? "animate-spin" : ""}`} />
            Sync BMs
          </Button>
          <Button size="sm" disabled={!!syncing} onClick={() => sync("sync_accounts")}>
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing === "accounts" ? "animate-spin" : ""}`} />
            Sync Contas
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="BMs" value={stats.bms} />
        <StatCard label="Contas" value={stats.accounts} />
        <StatCard label="Atribuídas" value={stats.assigned} accent />
        <StatCard label="Bloqueadas" value={stats.blocked} danger />
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por nome ou ID da conta..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Select value={filterBm} onValueChange={setFilterBm}>
            <SelectTrigger className="w-[220px]">
              <Building2 className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Todas as BMs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as BMs</SelectItem>
              {bms.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="active">Ativas</SelectItem>
              <SelectItem value="blocked">Bloqueadas</SelectItem>
              <SelectItem value="assigned">Atribuídas</SelectItem>
              <SelectItem value="unassigned">Sem cliente</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-lg border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Conta</TableHead>
                <TableHead>BM</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Gasto</TableHead>
                <TableHead className="min-w-[240px]">Cliente atribuído</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma conta encontrada.</TableCell></TableRow>
              ) : (
                filtered.map((a) => {
                  const clientId = currentClient(a.id);
                  return (
                    <TableRow key={a.id}>
                      <TableCell>
                        <div className="font-medium text-sm">{a.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{a.meta_account_id}</div>
                      </TableCell>
                      <TableCell className="text-sm">{bmName(a.bm_id)}</TableCell>
                      <TableCell>
                        <Badge variant={a.status === "active" ? "default" : "destructive"}>
                          {a.status === "active" ? "Ativa" : "Bloqueada"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-mono">
                        {a.currency} {(a.amount_spent || 0).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2 items-center">
                          <Select
                            value={clientId || "none"}
                            onValueChange={(v) => assign(a.id, v === "none" ? null : v)}
                          >
                            <SelectTrigger className="flex-1 h-9">
                              <SelectValue placeholder="Não atribuída" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">— Nenhum —</SelectItem>
                              {clients.map((c) => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {clientId ? (
                            <Link2 className="h-4 w-4 text-primary" />
                          ) : (
                            <Unlink className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

function StatCard({ label, value, accent, danger }: { label: string; value: number; accent?: boolean; danger?: boolean }) {
  return (
    <Card className={`p-4 ${accent ? "border-primary/40" : ""} ${danger ? "border-destructive/40" : ""}`}>
      <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className={`text-2xl font-display font-bold mt-1 ${accent ? "text-primary glow-text" : danger ? "text-destructive" : ""}`}>
        {value}
      </div>
    </Card>
  );
}
