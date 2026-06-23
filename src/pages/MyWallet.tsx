import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/hooks/useWallet";
import { ArrowLeft, Copy, QrCode, Receipt, Wallet as WalletIcon, ExternalLink } from "lucide-react";

interface Deposit {
  id: string;
  amount: number;
  status: string;
  status_detail: string | null;
  external_reference: string;
  mercado_pago_payment_id: string | null;
  pix_qr_code: string | null;
  pix_qr_code_base64: string | null;
  pix_ticket_url: string | null;
  credited_at: string | null;
  created_at: string;
}

interface WTx {
  id: string;
  type: string;
  amount: number;
  balance_after: number;
  status: string;
  description: string | null;
  reference_type: string | null;
  created_at: string;
}

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

function statusBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    approved: { label: "Aprovado", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
    pending: { label: "Pendente", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
    rejected: { label: "Recusado", cls: "bg-red-500/15 text-red-400 border-red-500/30" },
    cancelled: { label: "Cancelado", cls: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30" },
    completed: { label: "Concluído", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  };
  const m = map[status] ?? { label: status, cls: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30" };
  return <Badge variant="outline" className={m.cls}>{m.label}</Badge>;
}

export default function MyWallet() {
  const { toast } = useToast();
  const { balance, loading: balLoading, refresh } = useWallet();
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [txs, setTxs] = useState<WTx[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const [{ data: dep }, { data: tx }] = await Promise.all([
      supabase.from("wallet_deposits").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
      supabase.from("wallet_transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
    ]);
    setDeposits((dep ?? []) as Deposit[]);
    setTxs((tx ?? []) as WTx[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast({ title: "Copiado!", description: "Código Pix copiado." });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <Link to="/marketplace" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" /> Voltar ao marketplace
          </Link>
          <Button variant="outline" size="sm" onClick={() => { refresh(); load(); }}>Atualizar</Button>
        </div>

        <Card className="mb-6 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-medium text-muted-foreground">
              <WalletIcon className="h-4 w-4" /> Saldo atual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{balLoading ? <Skeleton className="h-10 w-40" /> : fmtBRL(balance)}</div>
            <p className="text-xs text-muted-foreground mt-1">Atualizado em tempo real.</p>
          </CardContent>
        </Card>

        <Tabs defaultValue="deposits">
          <TabsList>
            <TabsTrigger value="deposits">Depósitos Pix ({deposits.length})</TabsTrigger>
            <TabsTrigger value="movements">Movimentações ({txs.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="deposits" className="mt-4 space-y-3">
            {loading && <Skeleton className="h-24 w-full" />}
            {!loading && deposits.length === 0 && (
              <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Nenhum depósito ainda.</CardContent></Card>
            )}
            {deposits.map((d) => (
              <Card key={d.id}>
                <CardContent className="py-4 flex items-center justify-between gap-4 flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-lg">{fmtBRL(Number(d.amount))}</span>
                      {statusBadge(d.status)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Criado em {fmtDate(d.created_at)}
                      {d.credited_at && ` • Creditado em ${fmtDate(d.credited_at)}`}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">Ref: {d.external_reference}</p>
                  </div>
                  <div className="flex gap-2">
                    {d.status !== "approved" && (d.pix_qr_code || d.pix_qr_code_base64) && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm"><QrCode className="h-4 w-4 mr-1" /> Ver Pix</Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader><DialogTitle>Pagar com Pix — {fmtBRL(Number(d.amount))}</DialogTitle></DialogHeader>
                          <div className="space-y-4">
                            {d.pix_qr_code_base64 && (
                              <div className="flex justify-center bg-white p-3 rounded-md">
                                <img src={`data:image/png;base64,${d.pix_qr_code_base64}`} alt="QR Code Pix" className="w-56 h-56" />
                              </div>
                            )}
                            {d.pix_qr_code && (
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Pix copia-e-cola</p>
                                <div className="flex gap-2">
                                  <code className="flex-1 text-[10px] break-all bg-muted p-2 rounded max-h-24 overflow-auto">{d.pix_qr_code}</code>
                                  <Button size="sm" variant="outline" onClick={() => copy(d.pix_qr_code!)}><Copy className="h-4 w-4" /></Button>
                                </div>
                              </div>
                            )}
                            {d.pix_ticket_url && (
                              <a href={d.pix_ticket_url} target="_blank" rel="noreferrer" className="text-sm text-primary inline-flex items-center gap-1">
                                Abrir comprovante <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                    {d.pix_ticket_url && d.status === "approved" && (
                      <Button asChild variant="outline" size="sm">
                        <a href={d.pix_ticket_url} target="_blank" rel="noreferrer"><Receipt className="h-4 w-4 mr-1" /> Comprovante</a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="movements" className="mt-4">
            <Card>
              <CardContent className="p-0">
                {loading && <div className="p-4"><Skeleton className="h-20 w-full" /></div>}
                {!loading && txs.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">Nenhuma movimentação.</p>}
                <div className="divide-y divide-border">
                  {txs.map((t) => (
                    <div key={t.id} className="p-4 flex items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">{t.description ?? t.type}</p>
                        <p className="text-xs text-muted-foreground">{fmtDate(t.created_at)} • {t.type}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${Number(t.amount) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {Number(t.amount) >= 0 ? "+" : ""}{fmtBRL(Number(t.amount))}
                        </p>
                        <p className="text-xs text-muted-foreground">Saldo: {fmtBRL(Number(t.balance_after))}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
