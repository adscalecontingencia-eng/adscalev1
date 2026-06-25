import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ExternalLink, ShieldCheck, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface AssetAccount {
  id?: string;
  account_number: number;
  status: string;
  is_prepaid?: boolean;
  gastos: number;
  limite_meta: number;
  ciclo: number;
  divida: number;
  saldo: number;
  extensao_limite?: number | null;
}

export interface MarketplaceAsset {
  id: string;
  name: string;
  platform: string;
  currency: string;
  year?: number | null;
  price: number;
  verified: boolean;
  notes?: string | null;
  status: string;
  accounts?: AssetAccount[];
}

const fmt = (n: number, currency = "BRL") => {
  const symbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : "R$";
  const v = Math.round(n || 0);
  return `${symbol} ${v.toLocaleString("pt-BR")}`;
};

const WHATSAPP_URL = "https://wa.me/5531998416336?text=";

interface Props {
  asset: MarketplaceAsset;
}

const AssetCard: React.FC<Props> = ({ asset }) => {
  const [open, setOpen] = useState(false);
  const accounts = asset.accounts ?? [];

  const totals = useMemo(() => {
    const gastosTotais = accounts.reduce((s, a) => s + Number(a.gastos || 0), 0);
    const maiorLimite = accounts.reduce((m, a) => Math.max(m, Number(a.limite_meta || 0)), 0);
    const cicloTotal = accounts.reduce((s, a) => s + Number(a.ciclo || 0), 0);
    const dividaTotal = accounts.reduce((s, a) => s + Number(a.divida || 0), 0);
    const saldoTotal = accounts.reduce((s, a) => s + Number(a.saldo || 0), 0);
    return { gastosTotais, maiorLimite, cicloTotal, dividaTotal, saldoTotal };
  }, [accounts]);

  const flag = asset.currency === "USD" ? "🇺🇸" : asset.currency === "EUR" ? "🇪🇺" : "🇧🇷";
  const buyMsg = encodeURIComponent(`Olá! Tenho interesse no ativo ${asset.name} do marketplace AD SCALE.`);

  return (
    <motion.article
      whileHover={{ y: -3 }}
      className="rounded-2xl border border-border/60 bg-card/70 overflow-hidden flex flex-col"
    >
      <div className="p-5 space-y-4">
        <div>
          <h3 className="font-display font-bold text-foreground text-lg leading-tight">{asset.name}</h3>
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5">
              {flag} Contas em {asset.currency}
            </span>
            {asset.verified && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5">
                <ShieldCheck size={10} /> Verificada
              </span>
            )}
            {asset.year && (
              <span className="text-[11px] text-muted-foreground">Ano de Criação: {asset.year}</span>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-xs text-muted-foreground">Preço</span>
            <span className="font-display font-bold text-foreground text-xl">{fmt(asset.price, "BRL")}</span>
          </div>
        </div>

        <a
          href={`${WHATSAPP_URL}${buyMsg}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-sm transition-colors"
        >
          <ExternalLink size={14} /> Comprar via chat
        </a>

        <div className="grid grid-cols-2 gap-2 rounded-xl border border-border/40 bg-background/40 p-3">
          <KPI label="$ Gastos Totais" value={fmt(totals.gastosTotais, asset.currency)} tone="muted" />
          <KPI label="◎ Maior Limite" value={fmt(totals.maiorLimite, asset.currency)} tone="blue" />
          <KPI label="⇄ Ciclo Total" value={fmt(totals.cicloTotal, asset.currency)} tone="muted" />
          {totals.dividaTotal > 0 ? (
            <KPI label="🗎 Dívida Total" value={fmt(totals.dividaTotal, asset.currency)} tone="red" />
          ) : (
            <KPI label="🗎 Saldo Total" value={fmt(totals.saldoTotal, asset.currency)} tone="green" />
          )}
        </div>

        {accounts.length > 0 && (
          <div className="rounded-xl border border-border/40 bg-background/40 overflow-hidden">
            <div className="px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold border-b border-border/40">
              {accounts.length} contas de anúncio
            </div>
            <div className={`${open ? "" : "max-h-[180px]"} overflow-hidden transition-all`}>
              {accounts.map((a) => (
                <div key={`${a.account_number}-${a.id ?? ""}`} className="px-3 py-2 border-b border-border/30 last:border-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-md bg-blue-500/15 text-blue-300 text-[10px] font-bold">
                      {a.account_number}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5">
                      {a.status}
                    </span>
                    {a.is_prepaid && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider rounded-md bg-blue-500/10 text-blue-300 border border-blue-500/30 px-2 py-0.5">
                        Pré-Paga
                      </span>
                    )}
                  </div>
                  <Row label="Gastos" value={fmt(a.gastos, asset.currency)} />
                  <Row label="Limite Meta" value={fmt(a.limite_meta, asset.currency)} valueTone="blue" />
                  <Row label="Ciclo" value={fmt(a.ciclo, asset.currency)} />
                  {a.divida > 0 ? (
                    <Row label="Dívida" value={fmt(a.divida, asset.currency)} valueTone="red" />
                  ) : a.saldo > 0 ? (
                    <Row label="Saldo" value={fmt(a.saldo, asset.currency)} valueTone="green" />
                  ) : (
                    <Row label="Dívida" value={fmt(0, asset.currency)} />
                  )}
                </div>
              ))}
            </div>
            {accounts.length > 2 && (
              <button
                onClick={() => setOpen(o => !o)}
                className="w-full py-2 text-[11px] text-muted-foreground hover:text-primary flex items-center justify-center gap-1 border-t border-border/40"
              >
                {open ? <>Recolher <ChevronUp size={12} /></> : <>Ver todas <ChevronDown size={12} /></>}
              </button>
            )}
          </div>
        )}

        {asset.notes && (
          <div className="rounded-xl border border-border/40 bg-background/40 p-3">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-1">Observações</p>
            <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">{asset.notes}</p>
          </div>
        )}
      </div>
    </motion.article>
  );
};

const KPI: React.FC<{ label: string; value: string; tone: "muted" | "blue" | "red" | "green" }> = ({ label, value, tone }) => {
  const toneCls = tone === "blue" ? "text-blue-300" : tone === "red" ? "text-red-400" : tone === "green" ? "text-emerald-400" : "text-foreground";
  return (
    <div className="rounded-lg bg-background/60 border border-border/30 px-2.5 py-2">
      <p className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">{label}</p>
      <p className={`text-sm font-bold mt-0.5 ${toneCls}`}>{value}</p>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string; valueTone?: "blue" | "red" | "green" }> = ({ label, value, valueTone }) => {
  const toneCls = valueTone === "blue" ? "text-blue-300" : valueTone === "red" ? "text-red-400" : valueTone === "green" ? "text-emerald-400" : "text-foreground";
  return (
    <div className="flex items-center justify-between text-[11px] py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold ${toneCls}`}>{value}</span>
    </div>
  );
};

export default AssetCard;
