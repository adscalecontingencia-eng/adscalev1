import React, { useEffect, useMemo, useState } from "react";
import { tr } from '@/i18n';
import { getNumberLocale } from '@/i18n/format';
import { disableReasonLabel } from '@/lib/meta-labels';
import { supabase } from "@/integrations/supabase/client";
import { Ban, RefreshCw, AlertTriangle, ShieldAlert, Search, FileText, Copy, ExternalLink, BookOpen, X } from "lucide-react";
import { toast } from "sonner";

type BlockedAccount = {
  id: string;
  name: string;
  meta_account_id: string;
  account_status: number | null;
  disable_reason: number | null;
  disable_reason_label: string | null;
  status: string | null;
  updated_at: string;
  bm?: { name: string | null; verification_status: string | null; meta_bm_id?: string | null } | null;
};

type BlockedBM = {
  id: string;
  name: string;
  meta_bm_id: string;
  verification_status: string | null;
  updated_at: string;
};

type LogItem = {
  key: string;
  kind: "account" | "bm";
  title: string;
  badge: string;
  badgeTone: "red" | "amber";
  meta_id: string;
  parent: string;
  parent_id?: string | null;
  updated_at: string;
  category: "not_approved" | "suspended";
  type: "account" | "bm";
  reason_code: number | null;
  reason_label: string;
};

const STATUS_LABEL: Record<number, { label: string; tone: "red" | "amber" }> = {
  1: { get label() { return "ADS_INTEGRITY_POLICY · " + tr('blocklog.code.1'); }, tone: "red" },
  2: { get label() { return "ADS_IP_REVIEW · " + tr('blocklog.code.2'); }, tone: "amber" },
  3: { get label() { return "RISK_PAYMENT · " + tr('blocklog.code.3'); }, tone: "red" },
  4: { get label() { return "GRAY_ACCOUNT · " + tr('blocklog.code.4'); }, tone: "amber" },
  5: { get label() { return "ADS_AFC_REVIEW · " + tr('blocklog.code.5'); }, tone: "amber" },
  6: { get label() { return "BUSINESS_INTEGRITY_RAR · " + tr('blocklog.code.6'); }, tone: "red" },
  7: { get label() { return "PERMANENT_CLOSE · " + tr('blocklog.code.7'); }, tone: "red" },
  11: { get label() { return "BUSINESS_MANAGER_INTEGRITY · " + tr('blocklog.code.11'); }, tone: "red" },
  12: { get label() { return "MISREPRESENTED_AD_ACCOUNT · " + tr('blocklog.code.12'); }, tone: "red" },
  15: { get label() { return "COMPROMISED_AD_ACCOUNT · " + tr('blocklog.code.15'); }, tone: "red" },
};

const reasonForCode = (code: number | null, fallback: string | null) => {
  if (code && STATUS_LABEL[code]) return STATUS_LABEL[code];
  if (fallback && fallback !== "Nenhum") return { label: disableReasonLabel(fallback) || fallback, tone: "red" as const };
  return { label: tr('blocklog.suspended'), tone: "red" as const };
};

// Help center articles per disable_reason
const HELP_LINKS: Record<number, string> = {
  1: "https://www.facebook.com/business/help/975570072950669",   // Integridade de Anúncios
  2: "https://www.facebook.com/business/help/2150542373122697",  // Revisão IP
  3: "https://www.facebook.com/business/help/1525417224035590",  // Risco pagamento
  4: "https://www.facebook.com/business/help/975570072950669",
  5: "https://www.facebook.com/business/help/975570072950669",
  6: "https://www.facebook.com/business/help/273898912548414",   // Integridade do negócio
  7: "https://www.facebook.com/business/help/975570072950669",
  11: "https://www.facebook.com/business/help/273898912548414",
  12: "https://www.facebook.com/business/help/975570072950669",
  15: "https://www.facebook.com/business/help/428139328905464",  // Conta comprometida
};

const HELP_DEFAULT = "https://www.facebook.com/business/help/975570072950669";

const accountQualityUrl = (metaId: string) => {
  const id = metaId.replace(/^act_/, "");
  return `https://www.facebook.com/accountquality/${id}`;
};

const bmInfoUrl = (metaBmId: string) =>
  `https://business.facebook.com/settings/info?business_id=${metaBmId}`;

const APPEAL_TEMPLATES: Record<number, { titulo: string; corpo: string }> = {
  1: {
    titulo: "Recurso · Violação de Política de Integridade de Anúncios",
    corpo:
      "Solicito a revisão manual da minha conta de anúncios. Acredito que a restrição aplicada pode ter sido um falso positivo do sistema automatizado. Todos os meus anúncios e páginas de destino seguem as Políticas de Publicidade do Meta, incluindo as diretrizes de produtos proibidos, conteúdo enganoso, afirmações sensacionalistas e atributos pessoais. Estou disponível para fornecer qualquer documentação adicional necessária (CNPJ, comprovante de domínio, política de privacidade do site, processo de checkout) para comprovar a legitimidade da operação. Peço gentilmente a reanálise por um especialista humano.",
  },
  2: {
    titulo: "Recurso · Revisão de IP / Origem de Acesso",
    corpo:
      "Solicito a liberação da conta. O acesso foi realizado a partir de IP regular da minha localidade habitual e/ou de um colaborador autorizado da agência. Não houve tentativa de violação de segurança. Posso confirmar identidade, números de IP utilizados e dispositivos autorizados. Peço a remoção da restrição de IP.",
  },
  3: {
    titulo: "Recurso · Risco de Pagamento",
    corpo:
      "Solicito a revisão do método de pagamento da conta. O cartão vinculado é de titularidade legítima e está em situação regular junto ao emissor. Posso fornecer comprovação de titularidade, fatura recente e dados do CNPJ vinculado ao Business Manager. Peço a remoção da sinalização de risco de pagamento e a liberação para veiculação dos anúncios.",
  },
  6: {
    titulo: "Recurso · Integridade do Business Manager",
    corpo:
      "Solicito a revisão da restrição aplicada ao Business Manager. A operação é legítima, possui CNPJ ativo, domínio próprio verificado e segue todas as Políticas Comerciais e de Publicidade do Meta. Estou disponível para enviar documentação societária, comprovante de endereço, contrato social e qualquer informação adicional para confirmar a integridade do negócio.",
  },
  11: {
    titulo: "Recurso · Restrição em Business Manager",
    corpo:
      "Solicito a reanálise do Business Manager restringido. Não há histórico recente de violações nas contas vinculadas e os anúncios respeitam as Políticas de Publicidade do Meta. Peço a verificação manual e a remoção da restrição.",
  },
  12: {
    titulo: "Recurso · Conta deturpada (Misrepresentation)",
    corpo:
      "Solicito a revisão da conta. Os anúncios e a página de destino representam de forma fiel o produto/serviço oferecido, sem alegações exageradas, depoimentos não autorizados ou prática de bait-and-switch. Posso fornecer prints da landing page, processo de checkout e política de troca/devolução para comprovação.",
  },
  15: {
    titulo: "Recurso · Conta comprometida",
    corpo:
      "Solicito a recuperação do acesso à conta de anúncios. Realizei a alteração da senha da conta principal, ativei a autenticação em duas etapas e revisei todos os usuários com permissão no Business Manager. Peço a remoção da sinalização de comprometimento e a liberação da conta.",
  },
};

const APPEAL_DEFAULT = {
  titulo: "Recurso · Reanálise da conta de anúncios",
  corpo:
    "Solicito a revisão manual da restrição aplicada à minha conta. A operação é legítima e respeita todas as Políticas de Publicidade e Políticas Comerciais do Meta. Não houve identificação clara do motivo do bloqueio nas notificações recebidas. Peço a reanálise por um especialista humano e, caso necessário, a indicação dos pontos específicos que devem ser ajustados para conformidade.",
};

const APPEAL_BM_NOT_VERIFIED = {
  titulo: "Solicitação · Verificação do Business Manager",
  corpo:
    "Estou iniciando o processo de Verificação Comercial do Business Manager. Disponho de CNPJ ativo, comprovante de endereço comercial recente, documentação societária e domínio próprio para envio. Peço orientação sobre eventuais documentos complementares necessários para conclusão da verificação.",
};

const buildAppeal = (it: LogItem) => {
  if (it.type === "bm") return APPEAL_BM_NOT_VERIFIED;
  if (it.reason_code && APPEAL_TEMPLATES[it.reason_code]) return APPEAL_TEMPLATES[it.reason_code];
  return APPEAL_DEFAULT;
};

const buildFullText = (it: LogItem) => {
  const t = buildAppeal(it);
  const idLine = it.type === "account" ? `ID da Conta: ${it.meta_id}` : `ID do Business Manager: ${it.meta_id}`;
  return `${t.titulo}

Olá, equipe Meta.

${idLine}
${it.parent}
Motivo informado: ${it.reason_label}

${t.corpo}

Agradeço desde já a atenção e aguardo o retorno da equipe de análise.

Atenciosamente.`;
};

const fmtDate = (d: string) => {
  try {
    return new Date(d).toLocaleString(getNumberLocale(), { dateStyle: "short", timeStyle: "medium" });
  } catch { return d; }
};

const BlockLog: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [accounts, setAccounts] = useState<BlockedAccount[]>([]);
  const [bms, setBms] = useState<BlockedBM[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "not_approved" | "suspended">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "account" | "bm">("all");
  const [appealFor, setAppealFor] = useState<LogItem | null>(null);

  const load = async () => {
    setLoading(true);
    const [accRes, bmRes] = await Promise.all([
      supabase
        .from("meta_ad_accounts")
        .select("id, name, meta_account_id, account_status, disable_reason, disable_reason_label, status, updated_at, bm:meta_business_managers(name, verification_status, meta_bm_id)")
        .or("status.eq.blocked,disable_reason.gt.0,account_status.neq.1")
        .order("updated_at", { ascending: false }),
      supabase
        .from("meta_business_managers")
        .select("id, name, meta_bm_id, verification_status, updated_at")
        .neq("verification_status", "verified")
        .order("updated_at", { ascending: false }),
    ]);
    if (accRes.error) toast.error(accRes.error.message);
    if (bmRes.error) toast.error(bmRes.error.message);
    setAccounts((accRes.data as any) || []);
    setBms((bmRes.data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const items: LogItem[] = useMemo(() => {
    const acc = accounts.map<LogItem>((a) => {
      const r = reasonForCode(a.disable_reason, a.disable_reason_label);
      return {
        key: `acc-${a.id}`,
        kind: "account",
        title: a.name,
        badge: r.label,
        badgeTone: r.tone,
        meta_id: a.meta_account_id,
        parent: a.bm?.name ? `BM: ${a.bm.name}` : "BM: —",
        parent_id: a.bm?.meta_bm_id || null,
        updated_at: a.updated_at,
        category: "suspended",
        type: "account",
        reason_code: a.disable_reason,
        reason_label: r.label,
      };
    });
    const bb = bms.map<LogItem>((b) => ({
      key: `bm-${b.id}`,
      kind: "bm",
      title: b.name,
      badge: b.verification_status === "not_verified" || !b.verification_status ? tr('blocklog.bmUnverifiedBadge') : `${tr('blocklog.statusLbl')} ${b.verification_status}`,
      badgeTone: "amber",
      meta_id: b.meta_bm_id,
      parent: "Business Manager",
      parent_id: b.meta_bm_id,
      updated_at: b.updated_at,
      category: "not_approved",
      type: "bm",
      reason_code: null,
      reason_label: tr('blocklog.bmUnverified'),
    }));
    return [...acc, ...bb].sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at));
  }, [accounts, bms]);

  const filtered = items.filter((it) => {
    if (statusFilter !== "all" && it.category !== statusFilter) return false;
    if (typeFilter !== "all" && it.type !== typeFilter) return false;
    if (search && !`${it.title} ${it.meta_id} ${it.parent}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts = {
    all: items.length,
    not_approved: items.filter(i => i.category === "not_approved").length,
    suspended: items.filter(i => i.category === "suspended").length,
    type_account: items.filter(i => i.type === "account").length,
    type_bm: items.filter(i => i.type === "bm").length,
  };

  const sync = async () => {
    setSyncing(true);
    try {
      await supabase.functions.invoke("meta-sync", { body: { action: "sync_accounts" } });
      toast.success(tr('blocklog.syncDone'));
      await load();
    } catch (e: any) {
      toast.error(e?.message || tr('blocklog.syncError'));
    } finally {
      setSyncing(false);
    }
  };

  const openHelp = (it: LogItem) => {
    const url = it.type === "bm"
      ? "https://www.facebook.com/business/help/2058515294227817"
      : (it.reason_code && HELP_LINKS[it.reason_code]) || HELP_DEFAULT;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const openReview = (it: LogItem) => {
    const url = it.type === "bm"
      ? bmInfoUrl(it.meta_id)
      : accountQualityUrl(it.meta_id);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const TabBtn = ({ active, onClick, children, count, tone = "primary" }: any) => (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2 transition-all border ${
        active
          ? tone === "danger"
            ? "bg-destructive/15 text-destructive border-destructive/40"
            : "bg-primary/15 text-primary border-primary/40"
          : "bg-secondary/40 text-muted-foreground border-border hover:text-foreground"
      }`}>
      {children}
      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? "bg-background/40" : "bg-background/60"}`}>{count}</span>
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <Ban className="text-destructive" size={24} />
            {tr('blocklog.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tr('blocklog.desc')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm font-medium flex items-center gap-2">
            <AlertTriangle size={14} />
            {tr('blocklog.events', { n: items.length })}
          </div>
          <button onClick={sync} disabled={syncing}
            className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm flex items-center gap-2 hover:bg-secondary/70 disabled:opacity-50">
            <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
            {tr('blocklog.refresh')}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <TabBtn active={statusFilter === "all"} onClick={() => setStatusFilter("all")} count={counts.all}>{tr('blocklog.all')}</TabBtn>
          <TabBtn active={statusFilter === "not_approved"} onClick={() => setStatusFilter("not_approved")} count={counts.not_approved} tone="danger">{tr('blocklog.notApproved')}</TabBtn>
          <TabBtn active={statusFilter === "suspended"} onClick={() => setStatusFilter("suspended")} count={counts.suspended} tone="danger">{tr('blocklog.suspendedF')}</TabBtn>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase text-muted-foreground tracking-wider mr-1">{tr('blocklog.type')}</span>
          <TabBtn active={typeFilter === "all"} onClick={() => setTypeFilter("all")} count={counts.all}>{tr('blocklog.allTypes')}</TabBtn>
          <TabBtn active={typeFilter === "account"} onClick={() => setTypeFilter("account")} count={counts.type_account}>{tr('blocklog.adAccounts')}</TabBtn>
          <TabBtn active={typeFilter === "bm"} onClick={() => setTypeFilter("bm")} count={counts.type_bm}>Business Managers</TabBtn>
        </div>

        <div className="relative max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr('blocklog.search')}
            className="w-full bg-card border border-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {tr('blocklog.listTitle')}
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">{tr('blocklog.loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto text-primary mb-3" size={32} />
          <p className="text-sm font-medium text-foreground">{tr('blocklog.none')}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {tr('blocklog.healthy')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((it) => (
            <div key={it.key} className="rounded-xl border border-border bg-card hover:border-primary/30 transition-all p-4">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <Ban className={it.badgeTone === "red" ? "text-destructive" : "text-amber-400"} size={18} />
                <h3 className="font-display text-base font-semibold text-foreground">{it.title}</h3>
                <span className={`text-[11px] px-2 py-1 rounded-md font-medium ${
                  it.badgeTone === "red"
                    ? "bg-destructive/15 text-destructive border border-destructive/30"
                    : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                }`}>
                  {it.badge}
                </span>
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                {it.type === "account" ? tr('blocklog.accountId') : "BM ID"}: {it.meta_id} · {it.parent}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {tr('blocklog.updatedAt')} {fmtDate(it.updated_at)}
              </div>

              <div className="mt-3 pt-3 border-t border-border flex flex-wrap gap-2">
                <button onClick={() => openHelp(it)}
                  className="px-3 py-1.5 rounded-lg bg-secondary border border-border text-xs font-medium flex items-center gap-2 hover:bg-secondary/70 transition-colors">
                  <BookOpen size={13} />
                  {tr('blocklog.understand')}
                </button>
                <button onClick={() => setAppealFor(it)}
                  className="px-3 py-1.5 rounded-lg bg-secondary border border-border text-xs font-medium flex items-center gap-2 hover:bg-secondary/70 transition-colors">
                  <FileText size={13} />
                  {tr('blocklog.appealText')}
                </button>
                <button onClick={() => openReview(it)}
                  className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium flex items-center gap-2 hover:bg-primary/90 transition-colors">
                  <ExternalLink size={13} />
                  {tr('blocklog.requestReview')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {appealFor && (
        <AppealModal item={appealFor} onClose={() => setAppealFor(null)} />
      )}
    </div>
  );
};

const AppealModal: React.FC<{ item: LogItem; onClose: () => void }> = ({ item, onClose }) => {
  const [text, setText] = useState(() => buildFullText(item));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(tr('blocklog.copied'));
    } catch {
      toast.error(tr('blocklog.copyFail'));
    }
  };

  const openSupport = () => {
    const url = item.type === "bm"
      ? `https://business.facebook.com/settings/info?business_id=${item.meta_id}`
      : `https://www.facebook.com/accountquality/${item.meta_id.replace(/^act_/, "")}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between p-5 border-b border-border">
          <div>
            <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
              <FileText className="text-primary" size={18} />
              {tr('blocklog.appealTitle')}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {item.title} · {item.reason_label}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          <p className="text-xs text-muted-foreground mb-2">
            {tr('blocklog.appealHint')}
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={16}
            className="w-full bg-background border border-border rounded-lg p-3 text-sm font-mono text-foreground focus:outline-none focus:border-primary resize-y"
          />
        </div>

        <div className="flex flex-wrap gap-2 justify-end p-5 border-t border-border">
          <button onClick={onClose}
            className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm hover:bg-secondary/70">
            {tr('blocklog.cancel')}
          </button>
          <button onClick={copy}
            className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm flex items-center gap-2 hover:bg-secondary/70">
            <Copy size={14} />
            {tr('blocklog.copy')}
          </button>
          <button onClick={openSupport}
            className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 hover:bg-primary/90">
            <ExternalLink size={14} />
            {tr('blocklog.openMeta')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BlockLog;
