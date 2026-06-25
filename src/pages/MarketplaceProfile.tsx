import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/hooks/useWallet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AnimatedBackground from "@/components/AnimatedBackground";
import AdScaleLogo from "@/components/AdScaleLogo";
import WalletDepositModal from "@/components/marketplace/WalletDepositModal";
import { ArrowLeft, ShoppingBag, Wallet, BadgeDollarSign, Crown, User as UserIcon, Calendar, Settings, KeyRound, Receipt, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString("pt-BR") : "—";

const NIVEIS = [
  { nivel: 1, min: 0, next: 1000 },
  { nivel: 2, min: 1000, next: 5000 },
  { nivel: 3, min: 5000, next: 15000 },
  { nivel: 4, min: 15000, next: 50000 },
  { nivel: 5, min: 50000, next: 999999999 },
];

function getNivel(totalGasto: number) {
  for (let i = NIVEIS.length - 1; i >= 0; i--) {
    if (totalGasto >= NIVEIS[i].min) {
      const n = NIVEIS[i];
      const progress = n.next > n.min ? Math.min(100, ((totalGasto - n.min) / (n.next - n.min)) * 100) : 100;
      const restante = Math.max(0, n.next - totalGasto);
      return { nivel: n.nivel, progress, restante, next: n.next };
    }
  }
  return { nivel: 1, progress: 0, restante: 1000, next: 1000 };
}

interface Deposit {
  id: string;
  amount: number;
  status: string;
  credited_at: string | null;
  created_at: string;
}

export default function MarketplaceProfile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { balance } = useWallet();
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [totalGasto, setTotalGasto] = useState(0);
  const [totalDepositado, setTotalDepositado] = useState(0);
  const [loading, setLoading] = useState(true);
  const [walletOpen, setWalletOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>("");

  // Edit form
  const [editName, setEditName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { setLoading(false); return; }
      setUserId(authUser.id);
      setCreatedAt(authUser.created_at);
      setEditName((authUser.user_metadata as any)?.name || "");

      const [{ data: dep }, { data: tx }] = await Promise.all([
        supabase.from("wallet_deposits").select("id,amount,status,credited_at,created_at")
          .eq("user_id", authUser.id).order("created_at", { ascending: false }),
        supabase.from("wallet_transactions").select("type,amount")
          .eq("user_id", authUser.id),
      ]);
      setDeposits((dep ?? []) as Deposit[]);
      const depSum = (dep ?? []).filter((d: any) => d.status === "approved").reduce((s: number, d: any) => s + Number(d.amount), 0);
      setTotalDepositado(depSum);
      const gastoSum = (tx ?? []).filter((t: any) => t.type === "purchase").reduce((s: number, t: any) => s + Math.abs(Number(t.amount)), 0);
      setTotalGasto(gastoSum);
      setLoading(false);
    })();
  }, []);

  const nivelInfo = getNivel(totalGasto);
  const initials = (user?.name || "U").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

  const handleSavePassword = async () => {
    if (newPassword.length < 6) { toast.error("A senha deve ter ao menos 6 caracteres"); return; }
    setSavingPwd(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPwd(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Senha alterada com sucesso");
      setPasswordOpen(false);
      setNewPassword("");
    }
  };

  const handleSaveName = async () => {
    const { error } = await supabase.auth.updateUser({ data: { name: editName } });
    if (error) toast.error(error.message);
    else { toast.success("Perfil atualizado"); setEditOpen(false); }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <AnimatedBackground className="fixed" />

      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 h-16 flex items-center gap-4">
          <Link to="/marketplace" className="flex items-center gap-2 text-primary notranslate" translate="no" aria-label="AD SCALE">
            <AdScaleLogo size={22} />
          </Link>
          <Button variant="ghost" size="sm" onClick={() => navigate("/marketplace")}>
            <ArrowLeft size={14} className="mr-1.5" /> Voltar ao marketplace
          </Button>
        </div>
      </header>

      <main className="relative max-w-7xl mx-auto px-4 lg:px-6 py-8 space-y-6">
        {/* Header card */}
        <div className="rounded-2xl border border-border/60 bg-card/60 p-6 flex flex-col md:flex-row items-start gap-6">
          <div className="relative">
            <div className="w-28 h-28 rounded-full bg-secondary/40 border border-border flex items-center justify-center text-4xl font-bold text-foreground/60">
              {initials.charAt(0)}
            </div>
            <span className="absolute -bottom-1 right-1 inline-flex items-center justify-center w-7 h-7 rounded-full bg-purple-500 text-white text-xs font-bold border-2 border-background">
              {nivelInfo.nivel}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h1 className="font-display text-2xl font-bold text-foreground">{user?.name || "Usuário"}</h1>
              <Badge className="bg-purple-500/15 text-purple-300 border-purple-500/30 hover:bg-purple-500/20">Nível {nivelInfo.nivel}</Badge>
            </div>
            <p className="text-muted-foreground text-sm">{user?.email}</p>
            <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><UserIcon size={13} /> ID: <span className="text-foreground/80 font-mono">usr_{userId.slice(0, 10)}</span></span>
              <span className="inline-flex items-center gap-1.5"><Calendar size={13} /> Membro desde {fmtDate(createdAt)}</span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Settings size={14} className="mr-1.5" /> Editar Perfil
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPasswordOpen(true)}>
              <KeyRound size={14} className="mr-1.5" /> Alterar Senha
            </Button>
          </div>
        </div>

        {/* 4 KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard icon={ShoppingBag} label="Total Gasto" value={fmtBRL(totalGasto)} hint={`${fmtBRL(nivelInfo.restante)} para próximo nível`} tone="white" />
          <KpiCard icon={Wallet} label="Saldo Atual" value={fmtBRL(balance)} hint="Disponível para compras" tone="green" />
          <KpiCard icon={BadgeDollarSign} label="Total Depositado" value={fmtBRL(totalDepositado)} hint="Histórico de depósitos" tone="white" />
          <KpiCard icon={Crown} label="Nível Atual" value={`Nível ${nivelInfo.nivel}`} hint="" tone="white" progress={nivelInfo.progress} />
        </div>

        {/* Histórico de depósitos */}
        <div className="rounded-2xl border border-border/60 bg-card/60 p-5">
          <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
            <div>
              <h2 className="font-display text-base font-semibold text-foreground flex items-center gap-2">
                <BadgeDollarSign size={18} /> Histórico de Depósitos
              </h2>
              <p className="text-xs text-muted-foreground">Visualize todos os seus depósitos realizados na plataforma</p>
            </div>
            <Button size="sm" onClick={() => setWalletOpen(true)}>
              <Plus size={14} className="mr-1.5" /> Adicionar saldo
            </Button>
          </div>

          {loading ? (
            <div className="py-16 text-center text-muted-foreground text-sm">Carregando…</div>
          ) : deposits.length === 0 ? (
            <div className="py-16 text-center">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-secondary/40 border border-border flex items-center justify-center mb-3">
                <Receipt size={22} className="text-muted-foreground" />
              </div>
              <p className="font-display font-semibold text-foreground">Nenhum depósito encontrado</p>
              <p className="text-sm text-muted-foreground mt-1">
                Você ainda não realizou nenhum depósito. Faça seu primeiro depósito para começar a comprar!
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {deposits.map(d => (
                <div key={d.id} className="flex items-center justify-between p-3 rounded-lg bg-background/40 border border-border/40 text-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
                      <BadgeDollarSign size={16} />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{fmtBRL(d.amount)}</p>
                      <p className="text-[11px] text-muted-foreground">{new Date(d.created_at).toLocaleString("pt-BR")}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={
                    d.status === "approved" ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10" :
                    d.status === "pending" ? "border-amber-500/30 text-amber-400 bg-amber-500/10" :
                    "border-red-500/30 text-red-400 bg-red-500/10"
                  }>
                    {d.status === "approved" ? "Aprovado" : d.status === "pending" ? "Pendente" : d.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <WalletDepositModal open={walletOpen} onOpenChange={setWalletOpen} />

      {/* Edit modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Perfil</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Nome</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={user?.email || ""} disabled />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveName}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password modal */}
      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Alterar Senha</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Nova senha</Label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordOpen(false)}>Cancelar</Button>
            <Button onClick={handleSavePassword} disabled={savingPwd}>{savingPwd ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const KpiCard: React.FC<{ icon: any; label: string; value: string; hint: string; tone: "white" | "green"; progress?: number }> = ({ icon: Icon, label, value, hint, tone, progress }) => (
  <div className="rounded-2xl border border-border/60 bg-card/60 p-5">
    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-3">
      <Icon size={14} /> {label}
    </div>
    <p className={`font-display text-2xl font-bold ${tone === "green" ? "text-emerald-400" : "text-foreground"}`}>{value}</p>
    {progress !== undefined ? (
      <div className="mt-3">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
          <span>{hint}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-secondary/40 overflow-hidden">
          <div className="h-full bg-purple-500" style={{ width: `${progress}%` }} />
        </div>
      </div>
    ) : (
      hint && <p className="text-xs text-muted-foreground mt-2">{hint}</p>
    )}
  </div>
);
