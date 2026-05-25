import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Handshake, Users, DollarSign, Clock, CheckCircle2, Search, Pencil, Save, X } from "lucide-react";
import { PageHero } from "@/components/ui-kit";
import { toast } from "sonner";
import { formatDateBR, parseDateLocal } from "@/lib/date-utils";

interface Partner {
  id: string;
  name: string;
  email: string;
  whatsapp_phone: string | null;
  pix_key: string | null;
  commission_pct: number;
  status: string;
  created_at: string;
}

interface PC {
  id: string;
  partner_id: string;
  client_id: string;
  amount: number;
  base_amount: number;
  pct_applied: number;
  status: string;
  paid_at: string | null;
  created_at: string;
}

const fmt = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const Partners: React.FC = () => {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [commissions, setCommissions] = useState<PC[]>([]);
  const [clientsByPartner, setClientsByPartner] = useState<Record<string, { id: string; name: string }[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editingPct, setEditingPct] = useState<string | null>(null);
  const [pctDraft, setPctDraft] = useState<string>("");

  const reload = async () => {
    const [pRes, pcRes, cRes] = await Promise.all([
      supabase.from("partners").select("*").order("created_at", { ascending: false }),
      supabase.from("partner_commissions").select("*").order("created_at", { ascending: false }),
      supabase.from("clients").select("id, name, partner_id").not("partner_id", "is", null),
    ]);
    setPartners((pRes.data as any) || []);
    setCommissions((pcRes.data as any) || []);
    const map: Record<string, { id: string; name: string }[]> = {};
    (cRes.data || []).forEach((c: any) => {
      if (!map[c.partner_id]) map[c.partner_id] = [];
      map[c.partner_id].push({ id: c.id, name: c.name });
    });
    setClientsByPartner(map);
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const totals = useMemo(() => {
    const pendente = commissions.filter(c => c.status === "pendente").reduce((s, c) => s + Number(c.amount), 0);
    const pago = commissions.filter(c => c.status === "pago").reduce((s, c) => s + Number(c.amount), 0);
    return { pendente, pago, total: pendente + pago };
  }, [commissions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return partners;
    return partners.filter(p => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q));
  }, [partners, search]);

  const markPaid = async (pc: PC) => {
    const { error } = await supabase.from("partner_commissions").update({ status: "pago", paid_at: new Date().toISOString() }).eq("id", pc.id);
    if (error) return toast.error("Erro ao marcar como pago: " + error.message);
    toast.success("Pago! Lançamento criado no Faturamento.");
    reload();
  };

  const savePct = async (partnerId: string) => {
    const n = parseFloat(pctDraft);
    if (!Number.isFinite(n) || n < 0 || n > 100) return toast.error("Percentual inválido");
    const { error } = await supabase.from("partners").update({ commission_pct: n }).eq("id", partnerId);
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Percentual atualizado");
    setEditingPct(null);
    reload();
  };

  if (loading) return <div className="p-10 text-center text-sm text-muted-foreground">Carregando…</div>;

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Programa de indicação"
        title={<span className="flex items-center gap-3"><Handshake size={22} className="text-primary" /> Parceiros</span>}
        description="Gerencie os parceiros do programa de indicação e suas comissões"
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: Users, label: "Parceiros ativos", value: partners.filter(p => p.status === "active").length, color: "text-primary" },
          { icon: Clock, label: "Comissões pendentes", value: fmt(totals.pendente), color: "text-yellow-400" },
          { icon: CheckCircle2, label: "Já pago", value: fmt(totals.pago), color: "text-green-400" },
          { icon: DollarSign, label: "Total acumulado", value: fmt(totals.total), color: "text-blue-400" },
        ].map(k => (
          <div key={k.label} className="bg-card/60 border border-border/60 rounded-xl p-4">
            <div className={`${k.color} mb-2`}><k.icon size={18} /></div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k.label}</div>
            <div className="text-lg font-bold text-foreground mt-1">{k.value}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar parceiro por nome ou e-mail…"
          className="w-full bg-secondary/50 border border-border rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-primary" />
      </div>

      {/* List */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="bg-card/40 border border-border/60 rounded-xl p-10 text-center text-sm text-muted-foreground">
            Nenhum parceiro cadastrado ainda.
          </div>
        )}
        {filtered.map(p => {
          const myCommissions = commissions.filter(c => c.partner_id === p.id);
          const pendente = myCommissions.filter(c => c.status === "pendente").reduce((s, c) => s + Number(c.amount), 0);
          const pago = myCommissions.filter(c => c.status === "pago").reduce((s, c) => s + Number(c.amount), 0);
          const myClients = clientsByPartner[p.id] || [];
          const open = expanded === p.id;
          return (
            <motion.div key={p.id} layout className="bg-card/60 border border-border/60 rounded-xl overflow-hidden">
              <button onClick={() => setExpanded(open ? null : p.id)} className="w-full text-left p-4 flex items-center gap-4 hover:bg-secondary/30 transition-colors">
                <div className="w-10 h-10 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                  {p.name[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-foreground truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{p.email}</div>
                </div>
                <div className="hidden sm:flex items-center gap-6 text-xs">
                  <div className="text-center">
                    <div className="text-[10px] uppercase text-muted-foreground">Indicados</div>
                    <div className="font-semibold text-foreground">{myClients.length}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] uppercase text-muted-foreground">% Comissão</div>
                    <div className="font-semibold text-primary">{Number(p.commission_pct)}%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] uppercase text-muted-foreground">Pendente</div>
                    <div className="font-semibold text-yellow-400">{fmt(pendente)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] uppercase text-muted-foreground">Pago</div>
                    <div className="font-semibold text-green-400">{fmt(pago)}</div>
                  </div>
                </div>
              </button>

              {open && (
                <div className="p-5 border-t border-border/60 space-y-4 bg-background/30">
                  <div className="grid sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <div className="text-[10px] uppercase text-muted-foreground mb-1">WhatsApp</div>
                      <div className="text-foreground">{p.whatsapp_phone || "—"}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-muted-foreground mb-1">Pix</div>
                      <div className="text-foreground break-all">{p.pix_key || "—"}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-muted-foreground mb-1">% de comissão</div>
                      {editingPct === p.id ? (
                        <div className="flex items-center gap-1">
                          <input type="number" step="0.1" value={pctDraft} onChange={e => setPctDraft(e.target.value)}
                            className="w-20 bg-secondary/50 border border-border rounded px-2 py-1 text-xs" />
                          <button onClick={() => savePct(p.id)} className="text-primary"><Save size={14} /></button>
                          <button onClick={() => setEditingPct(null)} className="text-muted-foreground"><X size={14} /></button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-foreground font-semibold">{Number(p.commission_pct)}%</span>
                          <button onClick={() => { setEditingPct(p.id); setPctDraft(String(p.commission_pct)); }} className="text-muted-foreground hover:text-primary"><Pencil size={12} /></button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Referred clients */}
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Clientes indicados ({myClients.length})</div>
                    <div className="flex flex-wrap gap-2">
                      {myClients.length === 0 && <span className="text-xs text-muted-foreground">Nenhum cliente vinculado.</span>}
                      {myClients.map(c => (
                        <span key={c.id} className="text-xs bg-secondary/60 border border-border/60 px-2.5 py-1 rounded-full text-foreground">{c.name}</span>
                      ))}
                    </div>
                  </div>

                  {/* Commissions */}
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Comissões</div>
                    {myCommissions.length === 0 ? (
                      <div className="text-xs text-muted-foreground py-3">Nenhuma comissão gerada ainda.</div>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-border/60">
                        <table className="w-full text-xs">
                          <thead className="bg-secondary/40 text-[10px] uppercase text-muted-foreground">
                            <tr>
                              <th className="text-left px-3 py-2 font-medium">Data</th>
                              <th className="text-right px-3 py-2 font-medium">Base</th>
                              <th className="text-right px-3 py-2 font-medium">%</th>
                              <th className="text-right px-3 py-2 font-medium">Comissão</th>
                              <th className="text-center px-3 py-2 font-medium">Status</th>
                              <th className="text-right px-3 py-2 font-medium">Ação</th>
                            </tr>
                          </thead>
                          <tbody>
                            {myCommissions.map(c => (
                              <tr key={c.id} className="border-t border-border/40">
                                <td className="px-3 py-2 text-muted-foreground">{formatDateBR(c.created_at.slice(0,10))}</td>
                                <td className="px-3 py-2 text-right text-muted-foreground">{fmt(Number(c.base_amount))}</td>
                                <td className="px-3 py-2 text-right text-muted-foreground">{Number(c.pct_applied)}%</td>
                                <td className="px-3 py-2 text-right font-semibold text-primary">{fmt(Number(c.amount))}</td>
                                <td className="px-3 py-2 text-center">
                                  {c.status === "pago" ? (
                                    <span className="text-[9px] uppercase tracking-wider text-green-400 bg-green-500/10 border border-green-500/30 px-2 py-0.5 rounded-full">Pago</span>
                                  ) : (
                                    <span className="text-[9px] uppercase tracking-wider text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 px-2 py-0.5 rounded-full">Pendente</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {c.status !== "pago" && (
                                    <button onClick={() => markPaid(c)} className="text-[10px] uppercase tracking-wider text-primary hover:underline">Marcar pago</button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default Partners;
