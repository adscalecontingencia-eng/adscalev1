import { useEffect, useMemo, useState, useCallback } from "react";
import ReactFlow, {
  Background, Controls, MiniMap, MarkerType,
  type Node, type Edge, useNodesState, useEdgesState, Handle, Position,
} from "reactflow";
import "reactflow/dist/style.css";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Building2, User, CreditCard, Image as ImageIcon, FileText,
  RefreshCw, Zap, ChevronDown, ChevronUp, AlertTriangle, Globe,
} from "lucide-react";

type BM = {
  id: string; meta_bm_id: string; name: string;
  verification_status: string | null;
  account_count: number | null; pixel_count: number | null; page_count: number | null;
};
type Account = {
  id: string; bm_id: string | null; name: string; meta_account_id: string;
  status: string | null; account_status: number | null;
  amount_spent: number | null; balance: number | null; currency: string | null;
  funding_source: string | null; score: number | null;
  disable_reason_label: string | null; owner_business_name: string | null;
};

const fmt = (n: number | null, cur = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: cur || "USD", maximumFractionDigits: 0 }).format(n || 0);

/* ============== CUSTOM NODES ============== */
const baseCard = "rounded-md border-2 px-3 py-2 text-[11px] backdrop-blur-sm shadow-lg";

function ProfileNode({ data }: any) {
  return (
    <div className={`${baseCard} border-cyan-500/60 bg-cyan-500/10 min-w-[180px]`}>
      <Handle type="target" position={Position.Top} className="!bg-cyan-500" />
      <div className="flex items-center gap-1.5 text-[9px] uppercase text-cyan-300/80 mb-1">
        <User size={10} /> Perfil / Negócio
      </div>
      <div className="font-semibold text-cyan-100 truncate">{data.label}</div>
      {data.id && <div className="text-[9px] text-cyan-300/60 font-mono truncate">ID: {data.id}</div>}
      {(data.activeAccounts != null || data.inactiveAccounts != null) && (
        <div className="flex gap-2 mt-1.5 text-[9px]">
          <span className="text-primary">{data.activeAccounts ?? 0} ativas</span>
          <span className="text-destructive">{data.inactiveAccounts ?? 0} inativas</span>
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-cyan-500" />
    </div>
  );
}

function BMNode({ data }: any) {
  const verified = data.verification_status === "verified";
  return (
    <div className={`${baseCard} border-purple-500/60 bg-purple-500/10 min-w-[200px]`}>
      <Handle type="target" position={Position.Top} className="!bg-purple-500" />
      <div className="flex items-center justify-between gap-1.5 text-[9px] uppercase text-purple-300/80 mb-1">
        <span className="flex items-center gap-1"><Building2 size={10} /> Business Manager</span>
        <span className={`w-1.5 h-1.5 rounded-full ${verified ? "bg-primary" : "bg-yellow-400"}`} />
      </div>
      <div className="font-semibold text-purple-100 truncate">{data.label}</div>
      <div className="text-[9px] text-purple-300/60 font-mono truncate">ID: {data.id}</div>
      <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1.5 text-[9px] text-purple-200/80">
        <span>{data.accounts}c</span>
        <span className="text-primary">{data.activeAccounts ?? 0} ativas</span>
        <span className="text-destructive">{data.inactiveAccounts ?? 0} inativas</span>
        <span>{data.pixels}px</span>
        <span>{data.pages}pg</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-purple-500" />
    </div>
  );
}

function AccountNode({ data }: any) {
  const active = data.account_status === 1;
  const cls = active
    ? "border-primary/60 bg-primary/10"
    : "border-destructive/60 bg-destructive/10";
  const txt = active ? "text-primary" : "text-destructive";
  return (
    <div className={`${baseCard} ${cls} min-w-[200px]`}>
      <Handle type="target" position={Position.Top} className={active ? "!bg-primary" : "!bg-destructive"} />
      <div className={`flex items-center justify-between gap-1.5 text-[9px] uppercase ${txt} opacity-80 mb-1`}>
        <span className="flex items-center gap-1"><CreditCard size={10} /> Conta de Anúncio</span>
        <span className="text-[10px] font-bold">{data.score ?? 0}</span>
      </div>
      <div className="font-semibold truncate">{data.label}</div>
      <div className="text-[9px] text-muted-foreground font-mono truncate">{data.account_id}</div>
      <div className="grid grid-cols-2 gap-1 mt-1.5 text-[9px]">
        <div><span className="text-muted-foreground">Status:</span> <span className={txt}>{active ? "Ativa" : "Bloqueada"}</span></div>
        <div><span className="text-muted-foreground">Saldo:</span> {fmt(data.balance, data.currency)}</div>
        <div className="col-span-2"><span className="text-muted-foreground">Gasto:</span> {fmt(data.spent, data.currency)}</div>
      </div>
      {!active && data.reason && <div className="mt-1 text-[9px] text-destructive truncate">{data.reason}</div>}
      <Handle type="source" position={Position.Bottom} className={active ? "!bg-primary" : "!bg-destructive"} />
    </div>
  );
}

function PixelNode({ data }: any) {
  return (
    <div className={`${baseCard} border-yellow-500/60 bg-yellow-500/10 min-w-[140px]`}>
      <Handle type="target" position={Position.Top} className="!bg-yellow-500" />
      <div className="flex items-center gap-1.5 text-[9px] uppercase text-yellow-300/80 mb-0.5">
        <ImageIcon size={10} /> Pixels
      </div>
      <div className="font-semibold text-yellow-100">{data.count} pixel(s)</div>
    </div>
  );
}

function PageNode({ data }: any) {
  return (
    <div className={`${baseCard} border-blue-500/60 bg-blue-500/10 min-w-[140px]`}>
      <Handle type="target" position={Position.Top} className="!bg-blue-500" />
      <div className="flex items-center gap-1.5 text-[9px] uppercase text-blue-300/80 mb-0.5">
        <FileText size={10} /> Páginas
      </div>
      <div className="font-semibold text-blue-100">{data.count} página(s)</div>
    </div>
  );
}

const nodeTypes = {
  profile: ProfileNode,
  bm: BMNode,
  account: AccountNode,
  pixel: PixelNode,
  page: PageNode,
};

/* ============== LAYOUT ENGINE ============== */
function buildGraph(bms: BM[], accounts: Account[]) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Group BMs by owner_business_name (from accounts) — fallback "Meta Assets"
  const bmOwner = new Map<string, string>();
  for (const acc of accounts) {
    if (acc.bm_id && acc.owner_business_name && !bmOwner.has(acc.bm_id)) {
      bmOwner.set(acc.bm_id, acc.owner_business_name);
    }
  }
  const profileGroups = new Map<string, BM[]>();
  for (const bm of bms) {
    const owner = bmOwner.get(bm.id) || "Meta Assets";
    if (!profileGroups.has(owner)) profileGroups.set(owner, []);
    profileGroups.get(owner)!.push(bm);
  }

  const COL_W = 240;        // horizontal slot per leaf
  const ROW_H = 160;        // vertical row spacing
  const ACC_W = 230;        // account column width
  const RES_W = 160;        // resource (pixel/page) column width

  // Layout per profile: compute width based on total accounts + resources
  let cursorX = 0;
  const PROFILE_GAP = 80;

  profileGroups.forEach((profileBms, profileName) => {
    // Compute width per BM
    const bmWidths = profileBms.map(bm => {
      const accs = accounts.filter(a => a.bm_id === bm.id);
      const accCount = Math.max(accs.length, 1);
      const resCount = (bm.pixel_count ? 1 : 0) + (bm.page_count ? 1 : 0);
      const leafCount = accCount + resCount;
      return Math.max(leafCount * COL_W, 260);
    });
    const profileW = bmWidths.reduce((a, b) => a + b, 0) + (profileBms.length - 1) * 40;
    const profileCenterX = cursorX + profileW / 2;

    // Profile node (level 0)
    const profileId = `p:${profileName}`;
    nodes.push({
      id: profileId,
      type: "profile",
      position: { x: profileCenterX - 90, y: 0 },
      data: { label: profileName },
    });

    // BMs (level 1)
    let bmCursor = cursorX;
    profileBms.forEach((bm, i) => {
      const w = bmWidths[i];
      const bmCenterX = bmCursor + w / 2;
      const bmId = `bm:${bm.id}`;
      nodes.push({
        id: bmId,
        type: "bm",
        position: { x: bmCenterX - 100, y: ROW_H * 1.2 },
        data: {
          label: bm.name,
          id: bm.meta_bm_id,
          verification_status: bm.verification_status,
          accounts: bm.account_count ?? 0,
          activeAccounts: accounts.filter(a => a.bm_id === bm.id && a.account_status === 1).length,
          pixels: bm.pixel_count ?? 0,
          pages: bm.page_count ?? 0,
        },
      });
      edges.push({
        id: `e-${profileId}-${bmId}`, source: profileId, target: bmId,
        type: "smoothstep", animated: false,
        style: { stroke: "hsl(280 80% 60% / 0.5)", strokeWidth: 1.5 },
      });

      // Children: accounts + resources (level 2)
      const accs = accounts.filter(a => a.bm_id === bm.id);
      const resources: { kind: "pixel" | "page"; count: number }[] = [];
      if (bm.pixel_count) resources.push({ kind: "pixel", count: bm.pixel_count });
      if (bm.page_count) resources.push({ kind: "page", count: bm.page_count });

      const totalChildren = accs.length + resources.length;
      const childSpacing = totalChildren > 0 ? w / totalChildren : 0;
      let childCursor = bmCursor;

      accs.forEach((acc) => {
        const cx = childCursor + childSpacing / 2;
        childCursor += childSpacing;
        const accId = `acc:${acc.id}`;
        nodes.push({
          id: accId,
          type: "account",
          position: { x: cx - ACC_W / 2, y: ROW_H * 2.8 },
          data: {
            label: acc.name,
            account_id: acc.meta_account_id,
            account_status: acc.account_status,
            score: acc.score,
            balance: acc.balance,
            spent: acc.amount_spent,
            currency: acc.currency,
            reason: acc.disable_reason_label,
          },
        });
        const stroke = acc.account_status === 1 ? "hsl(120 100% 50% / 0.4)" : "hsl(0 84% 60% / 0.5)";
        edges.push({
          id: `e-${bmId}-${accId}`, source: bmId, target: accId,
          type: "smoothstep",
          style: { stroke, strokeWidth: 1.5 },
        });
      });

      resources.forEach((r, ri) => {
        const cx = childCursor + childSpacing / 2;
        childCursor += childSpacing;
        const rid = `${r.kind}:${bm.id}:${ri}`;
        nodes.push({
          id: rid,
          type: r.kind,
          position: { x: cx - RES_W / 2, y: ROW_H * 2.8 + 30 },
          data: { count: r.count },
        });
        const stroke = r.kind === "pixel" ? "hsl(45 100% 50% / 0.5)" : "hsl(210 100% 60% / 0.5)";
        edges.push({
          id: `e-${bmId}-${rid}`, source: bmId, target: rid,
          type: "smoothstep",
          style: { stroke, strokeWidth: 1.5 },
        });
      });

      bmCursor += w + 40;
    });

    cursorX += profileW + PROFILE_GAP;
  });

  return { nodes, edges };
}

/* ============== CONTINGENCY ANALYSIS ============== */
function analyzeContingency(bms: BM[], accounts: Account[]) {
  const alerts: { level: "warning" | "danger"; title: string; desc: string }[] = [];

  // BMs without verification
  const unverified = bms.filter(b => b.verification_status !== "verified");
  if (unverified.length > 0) {
    alerts.push({
      level: "warning",
      title: `${unverified.length} BM(s) não verificada(s)`,
      desc: `Verificação reduz risco de bloqueio. BMs: ${unverified.slice(0, 3).map(b => b.name).join(", ")}${unverified.length > 3 ? "..." : ""}`,
    });
  }

  // BMs without backup pages
  const noPage = bms.filter(b => !b.page_count || b.page_count === 0);
  if (noPage.length > 0) {
    alerts.push({
      level: "warning",
      title: `${noPage.length} BM(s) sem página configurada`,
      desc: `BMs sem página de backup: ${noPage.slice(0, 3).map(b => b.name).join(", ")}${noPage.length > 3 ? "..." : ""}`,
    });
  }

  // Blocked accounts
  const blocked = accounts.filter(a => a.account_status !== 1);
  if (blocked.length > 0) {
    alerts.push({
      level: "danger",
      title: `${blocked.length} conta(s) bloqueada(s)`,
      desc: `Verifique motivos no painel de detalhes para reativar.`,
    });
  }

  // Accounts without funding
  const noFunding = accounts.filter(a => !a.funding_source);
  if (noFunding.length > 0) {
    alerts.push({
      level: "warning",
      title: `${noFunding.length} conta(s) sem pagamento`,
      desc: `Configure forma de pagamento para evitar pausas.`,
    });
  }

  // Critical score
  const critical = accounts.filter(a => (a.score ?? 100) < 40);
  if (critical.length > 0) {
    alerts.push({
      level: "danger",
      title: `${critical.length} conta(s) com score crítico`,
      desc: `Risco alto de perda — revisar urgente.`,
    });
  }

  return alerts;
}

/* ============== MAIN PAGE ============== */
export default function AssetMap() {
  const [bms, setBms] = useState<BM[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [legendOpen, setLegendOpen] = useState(true);
  const [analysisOpen, setAnalysisOpen] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [b, a] = await Promise.all([
      supabase.from("meta_business_managers").select("*").order("name"),
      supabase.from("meta_ad_accounts").select("*").order("name"),
    ]);
    setBms((b.data as any) || []);
    setAccounts((a.data as any) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildGraph(bms, accounts), [bms, accounts]
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => { setNodes(initialNodes); setEdges(initialEdges); }, [initialNodes, initialEdges, setNodes, setEdges]);

  const alerts = useMemo(() => analyzeContingency(bms, accounts), [bms, accounts]);

  const refresh = async () => {
    setSyncing(true);
    try {
      await supabase.functions.invoke("meta-sync", { body: { action: "sync_accounts" } });
      await load();
    } finally { setSyncing(false); }
  };

  if (loading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Carregando mapa...</div>;
  }

  return (
    <div className="-m-4 lg:-m-6 h-[calc(100vh-3.5rem)] relative bg-background">
      {/* Top header */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-4 pointer-events-none">
        <div className="pointer-events-auto">
          <h1 className="font-display text-2xl font-bold text-foreground">Mapa de Ativos</h1>
          <p className="text-xs text-muted-foreground">Visualize todos os seus ativos Meta conectados.</p>
        </div>
        <Button onClick={refresh} disabled={syncing} className="pointer-events-auto gap-2">
          <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
          Atualizar mapa
        </Button>
      </div>

      {/* Flow */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: "smoothstep" }}
      >
        <Background color="hsl(var(--border))" gap={24} size={1} />
        <Controls className="!bg-card !border-border [&_button]:!bg-card [&_button]:!border-border [&_button]:!text-foreground" />
        <MiniMap
          className="!bg-card !border-border"
          nodeColor={(n) => {
            if (n.type === "profile") return "#06b6d4";
            if (n.type === "bm") return "#a855f7";
            if (n.type === "account") return (n.data as any)?.account_status === 1 ? "#22c55e" : "#ef4444";
            if (n.type === "pixel") return "#eab308";
            if (n.type === "page") return "#3b82f6";
            return "#666";
          }}
          maskColor="hsl(var(--background) / 0.8)"
        />
      </ReactFlow>

      {/* Legend bottom-left */}
      <Card className="absolute bottom-20 left-4 z-10 w-56 p-3 bg-card/90 backdrop-blur">
        <button onClick={() => setLegendOpen(v => !v)} className="w-full flex items-center justify-between text-[10px] uppercase text-muted-foreground tracking-wider mb-2">
          Legenda
          {legendOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        {legendOpen && (
          <div className="space-y-1.5 text-[11px]">
            <LegendRow color="bg-cyan-500" label="Perfil / Negócio" />
            <LegendRow color="bg-purple-500" label="Business Manager" />
            <LegendRow color="bg-primary" label="Conta ativa" />
            <LegendRow color="bg-destructive" label="Conta bloqueada" />
            <LegendRow color="bg-blue-500" label="Páginas" />
            <LegendRow color="bg-yellow-500" label="Pixels" />
            <div className="border-t border-border pt-1.5 mt-2 text-[9px] uppercase text-muted-foreground">Indicadores</div>
            <LegendRow color="bg-primary" label="Ativo / OK" dot />
            <LegendRow color="bg-yellow-400" label="Atenção" dot />
            <LegendRow color="bg-destructive" label="Bloqueado" dot />
          </div>
        )}
      </Card>

      {/* Contingency analysis right */}
      <Card className="absolute top-20 right-4 z-10 w-80 p-4 bg-card/90 backdrop-blur max-h-[calc(100vh-12rem)] overflow-y-auto">
        <button onClick={() => setAnalysisOpen(v => !v)} className="w-full flex items-center justify-between mb-3">
          <span className="flex items-center gap-2 font-semibold text-sm">
            <Zap size={14} className="text-yellow-400" />
            Análise de Contingência
          </span>
          {analysisOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {analysisOpen && (
          <>
            <div className="text-xs text-muted-foreground mb-3">{alerts.length} alerta(s) encontrado(s)</div>
            {alerts.length === 0 ? (
              <div className="text-xs text-primary text-center py-4">Tudo certo! Nenhum alerta.</div>
            ) : (
              <div className="space-y-2">
                {alerts.map((a, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-lg border text-xs ${
                      a.level === "danger"
                        ? "border-destructive/40 bg-destructive/10"
                        : "border-yellow-500/40 bg-yellow-500/10"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-semibold mb-1">
                      <span className={`w-2 h-2 rounded-full ${a.level === "danger" ? "bg-destructive" : "bg-yellow-400"}`} />
                      {a.title}
                    </div>
                    <div className="text-[11px] text-muted-foreground leading-relaxed">{a.desc}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Card>

      {bms.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Card className="p-8 text-center pointer-events-auto">
            <Globe size={40} className="mx-auto mb-3 text-muted-foreground" />
            <div className="font-semibold mb-1">Nenhum ativo conectado</div>
            <div className="text-xs text-muted-foreground mb-4">Sincronize suas BMs em Conexões Meta.</div>
          </Card>
        </div>
      )}
    </div>
  );
}

function LegendRow({ color, label, dot }: { color: string; label: string; dot?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`${dot ? "w-2 h-2" : "w-3 h-3"} rounded-full ${color}`} />
      <span>{label}</span>
    </div>
  );
}
