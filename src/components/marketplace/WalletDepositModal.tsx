import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Copy, Wallet as WalletIcon, Plus, History, CheckCircle2, Info, FlaskConical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/hooks/useWallet";

const fmt = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
const parseAmount = (s: string) => {
  const n = Number(String(s ?? "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialAmount?: number;
}

const QUICK = [50, 100, 200, 500];

export default function WalletDepositModal({ open, onOpenChange, initialAmount }: Props) {
  const { toast } = useToast();
  const { balance, refresh } = useWallet();
  const [amount, setAmount] = useState<string>(initialAmount ? String(initialAmount) : "200");
  const [creating, setCreating] = useState(false);
  const [pix, setPix] = useState<{ deposit_id: string; pix_qr_code: string | null; pix_qr_code_base64: string | null; pix_ticket_url: string | null; amount: number; test_mode?: boolean } | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [status, setStatus] = useState<string>("pending");
  const [history, setHistory] = useState<Array<{ id: string; type: string; amount: number; description: string | null; created_at: string }>>([]);
  const [tab, setTab] = useState<"deposit" | "history">("deposit");
  const pollRef = useRef<number | null>(null);
  const chRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!open) {
      stopWatch();
      setPix(null);
      setStatus("pending");
      return;
    }
    if (initialAmount) setAmount(String(initialAmount));
    loadHistory();
  }, [open, initialAmount]);

  function stopWatch() {
    if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
    if (chRef.current) { supabase.removeChannel(chRef.current); chRef.current = null; }
  }

  async function loadHistory() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("wallet_transactions")
      .select("id, type, amount, description, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    setHistory((data ?? []) as any);
  }

  function watchDeposit(depositId: string) {
    stopWatch();
    chRef.current = supabase
      .channel(`dep-${depositId}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "wallet_deposits", filter: `id=eq.${depositId}` },
        (p) => {
          const row = p.new as { status: string; credited_at: string | null };
          setStatus(row.status);
          if (row.credited_at) handleApproved();
        }).subscribe();

    pollRef.current = window.setInterval(async () => {
      try {
        const { data } = await supabase.functions.invoke("wallet-check-deposit", { body: { deposit_id: depositId } });
        const r = data as { status?: string; credited?: boolean };
        if (r?.status) setStatus(r.status);
        if (r?.credited) handleApproved();
      } catch { /* ignore */ }
    }, 5000);
  }

  function handleApproved() {
    stopWatch();
    setStatus("approved");
    refresh();
    loadHistory();
    toast({ title: "Pagamento confirmado", description: "Saldo creditado na sua carteira." });
  }

  async function generatePix() {
    const value = Number(String(amount).replace(",", "."));
    if (!(value > 0)) { toast({ title: "Valor inválido", variant: "destructive" }); return; }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("wallet-create-deposit", { body: { amount: value } });
      if (error) {
        let details = "";
        const context = (error as any)?.context;
        if (context?.json) {
          try {
            const body = await context.json();
            details = body?.error || body?.message || "";
          } catch { /* ignore */ }
        }
        throw new Error(details || error.message);
      }
      const r = data as any;
      if (r?.error) throw new Error(r.error);
      setPix(r);
      setStatus(r.status ?? "pending");
      watchDeposit(r.deposit_id);
    } catch (e: any) {
      toast({ title: "Erro ao gerar Pix", description: e?.message ?? String(e), variant: "destructive" });
    } finally { setCreating(false); }
  }

  async function copyPix() {
    if (!pix?.pix_qr_code) return;
    await navigator.clipboard.writeText(pix.pix_qr_code);
    toast({ title: "Código Pix copiado" });
  }

  async function simulatePayment() {
    if (!pix?.deposit_id) return;
    setSimulating(true);
    try {
      const { data, error } = await supabase.functions.invoke("wallet-simulate-payment", { body: { deposit_id: pix.deposit_id } });
      if (error) throw error;
      const r = data as any;
      if (r?.error) throw new Error(r.error);
      handleApproved();
    } catch (e: any) {
      toast({ title: "Erro ao simular", description: e?.message ?? String(e), variant: "destructive" });
    } finally { setSimulating(false); }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><WalletIcon className="w-5 h-5 text-primary" /> Carteira</DialogTitle>
          <DialogDescription>Gerencie seu saldo e depósitos.</DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Saldo disponível</div>
            <div className="text-2xl font-bold text-foreground">{fmt(balance)}</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-primary/15 text-primary grid place-items-center">
            <WalletIcon className="w-5 h-5" />
          </div>
        </div>

        <div className="flex gap-2">
          <Button size="sm" variant={tab === "deposit" ? "default" : "outline"} onClick={() => setTab("deposit")}>
            <Plus className="w-4 h-4 mr-1" /> Depositar
          </Button>
          <Button size="sm" variant={tab === "history" ? "default" : "outline"} onClick={() => { setTab("history"); loadHistory(); }}>
            <History className="w-4 h-4 mr-1" /> Histórico
          </Button>
        </div>

        {tab === "deposit" && !pix && (
          <div className="space-y-3">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Valor rápido</Label>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {QUICK.map((v) => (
                  <Button key={v} variant={parseAmount(amount) === v ? "default" : "outline"} size="sm" onClick={() => setAmount(String(v))}>

                    R$ {v}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="wd-amount" className="text-xs uppercase tracking-wider text-muted-foreground">Valor personalizado</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                <Input id="wd-amount" value={amount} onChange={(e) => setAmount(e.target.value)} className="pl-9" inputMode="decimal" />
              </div>
            </div>
            <div className="text-xs text-muted-foreground flex items-start gap-2 rounded-lg border border-border p-3">
              <Info className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Pagamento via PIX com confirmação instantânea. O saldo é creditado automaticamente após a confirmação do pagamento.</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={generatePix} disabled={creating}>
                {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                Depositar {fmt(Number(amount) || 0)}
              </Button>
            </div>
          </div>
        )}

        {tab === "deposit" && pix && status !== "approved" && (
          <div className="space-y-3">
            {pix.pix_qr_code_base64 && (
              <img src={`data:image/png;base64,${pix.pix_qr_code_base64}`} alt="QR Code Pix" className="w-48 h-48 mx-auto rounded-lg border border-border bg-white p-2" />
            )}
            {pix.pix_qr_code && (
              <div>
                <Label className="text-xs">Pix copia e cola</Label>
                <div className="flex gap-2 mt-1">
                  <Input readOnly value={pix.pix_qr_code} className="text-xs" />
                  <Button size="icon" variant="outline" onClick={copyPix}><Copy className="w-4 h-4" /></Button>
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground text-center">
              Aguardando pagamento de <strong>{fmt(pix.amount)}</strong>… atualiza automaticamente.
            </p>
            {pix.test_mode && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-500">
                  <FlaskConical className="w-4 h-4" /> Modo sandbox
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Contas teste do Mercado Pago não pagam Pix copia-e-cola. Clique abaixo para simular a aprovação.
                </p>
                <Button size="sm" variant="outline" className="w-full border-amber-500/40 text-amber-500 hover:bg-amber-500/10" onClick={simulatePayment} disabled={simulating}>
                  {simulating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FlaskConical className="w-4 h-4 mr-2" />}
                  Simular pagamento (sandbox)
                </Button>
              </div>
            )}
          </div>
        )}

        {tab === "deposit" && status === "approved" && (
          <div className="text-center py-6 space-y-2">
            <CheckCircle2 className="w-12 h-12 mx-auto text-primary" />
            <p className="font-semibold text-foreground">Saldo creditado!</p>
            <p className="text-xs text-muted-foreground">Novo saldo: {fmt(balance)}</p>
            <Button onClick={() => onOpenChange(false)} className="mt-2">Fechar</Button>
          </div>
        )}

        {tab === "history" && (
          <div className="max-h-72 overflow-y-auto space-y-1">
            {history.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">Nenhum movimento.</p>}
            {history.map((h) => (
              <div key={h.id} className="flex items-center justify-between text-xs border border-border rounded-lg px-3 py-2">
                <div>
                  <div className="font-medium text-foreground capitalize">{h.type}</div>
                  <div className="text-muted-foreground text-[11px]">{h.description ?? ""}</div>
                  <div className="text-muted-foreground text-[10px]">{new Date(h.created_at).toLocaleString("pt-BR")}</div>
                </div>
                <div className={Number(h.amount) >= 0 ? "text-primary font-semibold" : "text-destructive font-semibold"}>
                  {Number(h.amount) >= 0 ? "+" : ""}{fmt(Number(h.amount))}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
