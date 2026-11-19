import LanguageSwitcher from "@/components/LanguageSwitcher";
import { tr } from '@/i18n';
import { trHtml } from "@/i18n";
import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Users, DollarSign, Clock, CheckCircle2, LogOut, Handshake, Copy } from "lucide-react";
import AdScaleLogo from "@/components/AdScaleLogo";
import { toast } from "sonner";
import { formatDateBR } from "@/lib/date-utils";

interface Partner {
  id: string;
  name: string;
  email: string;
  whatsapp_phone: string | null;
  pix_key: string | null;
  commission_pct: number;
  status: string;
}

interface PCRow {
  id: string;
  amount: number;
  base_amount: number;
  pct_applied: number;
  status: string;
  paid_at: string | null;
  created_at: string;
  client_id: string;
  client_name?: string;
}

const fmt = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const PartnerDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [partner, setPartner] = useState<Partner | null>(null);
  const [rows, setRows] = useState<PCRow[]>([]);
  const [clientsMap, setClientsMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: p } = await supabase.from("partners").select("*").eq("id", user!.id).maybeSingle();
      setPartner(p as any);

      const { data: pcs } = await supabase
        .from("partner_commissions")
        .select("*")
        .order("created_at", { ascending: false });
      setRows((pcs as any) || []);

      // load my referred clients
      const { data: cls } = await supabase.from("clients").select("id,name").eq("partner_id", user!.id);
      const map: Record<string, string> = {};
      (cls || []).forEach((c: any) => { map[c.id] = c.name; });
      setClientsMap(map);
      setLoading(false);
    })();
  }, [user]);

  const stats = useMemo(() => {
    const pendente = rows.filter(r => r.status === "pendente").reduce((s, r) => s + Number(r.amount), 0);
    const pago = rows.filter(r => r.status === "pago").reduce((s, r) => s + Number(r.amount), 0);
    const total = pendente + pago;
    const clientCount = Object.keys(clientsMap).length;
    return { pendente, pago, total, clientCount };
  }, [rows, clientsMap]);

  const handleLogout = async () => { await logout(); navigate("/login"); };

  const copyReferralEmail = () => {
    if (!partner) return;
    navigator.clipboard.writeText(partner.email);
    toast.success(tr('ptn.copied'));
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground text-sm">{tr('ptn.loading')}</p></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 lg:px-6 h-16 flex items-center gap-4">
          <div className="text-primary"><AdScaleLogo size={24} /></div>
          <div className="hidden sm:flex items-center gap-2 text-[10px] uppercase tracking-[0.4em] text-muted-foreground/70">
            <Handshake size={12} className="text-primary" /> {tr('ptn.panel')}
          </div>
          <div className="ml-auto flex items-center gap-3">
            <LanguageSwitcher />
            <div className="text-xs text-muted-foreground truncate max-w-[180px]">{partner?.name}</div>
            <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-destructive transition-colors">
              <LogOut size={16} /> <span className="hidden sm:inline">{tr('ptn.logout')}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 lg:px-6 py-8 space-y-6">
        {/* Welcome */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card/60 backdrop-blur-sm border border-border/60 rounded-2xl p-6">
          <h1 className="font-display text-2xl font-bold text-foreground">{tr('ptn.hello', { name: partner?.name?.split(" ")[0] ?? "" })} 👋</h1>
          <p className="text-sm text-muted-foreground mt-1" dangerouslySetInnerHTML={{ __html: trHtml('ptn.yourPct', { pct: Number(partner?.commission_pct || 0) }) }} />
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={copyReferralEmail} className="inline-flex items-center gap-2 bg-primary/10 text-primary border border-primary/30 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-primary/20 transition-all">
              <Copy size={12} /> {tr('ptn.copyEmail')}
            </button>
          </div>
        </motion.div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: Users, label: tr('ptn.referred'), value: stats.clientCount, color: "text-blue-400" },
            { icon: Clock, label: tr('ptn.toReceive'), value: fmt(stats.pendente), color: "text-yellow-400" },
            { icon: CheckCircle2, label: tr('ptn.received'), value: fmt(stats.pago), color: "text-green-400" },
            { icon: DollarSign, label: tr('ptn.total'), value: fmt(stats.total), color: "text-primary" },
          ].map((k, i) => (
            <motion.div key={k.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="bg-card/60 border border-border/60 rounded-xl p-4">
              <div className={`${k.color} mb-2`}><k.icon size={18} /></div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k.label}</div>
              <div className="text-lg font-bold text-foreground mt-1">{k.value}</div>
            </motion.div>
          ))}
        </div>

        {/* Commissions table */}
        <div className="bg-card/60 backdrop-blur-sm border border-border/60 rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-border/60">
            <h2 className="font-display text-base font-semibold text-foreground">{tr('ptn.history')}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{tr('ptn.historyDesc')}</p>
          </div>
          {rows.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">{tr('ptn.none')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">{tr('ptn.date')}</th>
                    <th className="text-left px-4 py-2 font-medium">{tr('ptn.client')}</th>
                    <th className="text-right px-4 py-2 font-medium">{tr('ptn.agencyPay')}</th>
                    <th className="text-right px-4 py-2 font-medium">%</th>
                    <th className="text-right px-4 py-2 font-medium">{tr('ptn.yourComm')}</th>
                    <th className="text-center px-4 py-2 font-medium">{tr('ptn.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id} className="border-t border-border/40">
                      <td className="px-4 py-3 text-xs text-muted-foreground">{formatDateBR(r.created_at.slice(0,10))}</td>
                      <td className="px-4 py-3 text-foreground">{clientsMap[r.client_id] || "—"}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{fmt(Number(r.base_amount))}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{Number(r.pct_applied)}%</td>
                      <td className="px-4 py-3 text-right font-semibold text-primary">{fmt(Number(r.amount))}</td>
                      <td className="px-4 py-3 text-center">
                        {r.status === "pago" ? (
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-green-400 bg-green-500/10 border border-green-500/30 px-2 py-0.5 rounded-full">
                            <CheckCircle2 size={10} /> {tr('ptn.paid')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 px-2 py-0.5 rounded-full">
                            <Clock size={10} /> {tr('ptn.pending')}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground/60 mt-6">
          © {new Date().getFullYear()} <span className="notranslate" translate="no">AD Scale</span> · {tr('ptn.program')}
        </p>
      </main>
    </div>
  );
};

export default PartnerDashboard;
