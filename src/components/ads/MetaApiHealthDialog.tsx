import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, CheckCircle2, XCircle, AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { format, subDays } from "date-fns";
import { toast } from "sonner";

type ErrorItem = { account: string; erro: string };
type Result = {
  ok: boolean;
  since?: string;
  until?: string;
  contas: number;
  linhas_upsertadas: number;
  erros: ErrorItem[];
  aplicativos?: number;
  runtimeError?: string;
  elapsedMs: number;
};

const fmtISO = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// Group similar Meta errors so the UI shows what's actually broken.
function classifyError(msg: string): { label: string; hint: string } {
  const m = (msg || "").toLowerCase();
  if (m.includes("token") || m.includes("oauth") || m.includes("access") || m.includes("session")) {
    return { label: "Token inválido/expirado", hint: "Renove o System User Token nas Conexões Meta." };
  }
  if (m.includes("permission") || m.includes("permiss")) {
    return { label: "Sem permissão", hint: "A conta precisa ser atribuída ao System User da BM." };
  }
  if (m.includes("rate") || m.includes("limit") || m.includes("throttle") || m.includes("(#17)") || m.includes("(#4)")) {
    return { label: "Rate limit da Meta", hint: "Aguarde alguns minutos e sincronize novamente." };
  }
  if (m.includes("disabled") || m.includes("restricted") || m.includes("bloque") || m.includes("(#100)")) {
    return { label: "Conta bloqueada/restrita", hint: "Verifique o status da conta no Business Manager." };
  }
  if (m.includes("network") || m.includes("fetch") || m.includes("timeout") || m.includes("econn")) {
    return { label: "Falha de rede", hint: "Instabilidade momentânea — tente de novo." };
  }
  return { label: "Erro Meta", hint: msg };
}

export default function MetaApiHealthDialog() {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const runCheck = async () => {
    setRunning(true);
    setResult(null);
    const started = Date.now();
    try {
      const today = new Date();
      const since = fmtISO(subDays(today, 1));
      const until = fmtISO(today);
      const { data, error } = await supabase.functions.invoke("meta-sync", {
        body: { action: "sync_insights", since, until },
      });
      const elapsedMs = Date.now() - started;
      if (error) {
        setResult({
          ok: false, contas: 0, linhas_upsertadas: 0, erros: [],
          runtimeError: error.message, elapsedMs,
        });
        toast.error("Falha ao chamar meta-sync");
        return;
      }
      const d: any = data || {};
      if (d.erro) {
        setResult({
          ok: false, contas: 0, linhas_upsertadas: 0, erros: [],
          runtimeError: d.erro, elapsedMs,
        });
        return;
      }
      const erros: ErrorItem[] = d.erros || [];
      const contas: number = d.contas || 0;
      setResult({
        ok: erros.length === 0,
        since: d.since, until: d.until,
        contas,
        linhas_upsertadas: d.linhas_upsertadas || 0,
        erros,
        aplicativos: d.aplicativos,
        elapsedMs,
      });
    } catch (e: any) {
      setResult({
        ok: false, contas: 0, linhas_upsertadas: 0, erros: [],
        runtimeError: e.message, elapsedMs: Date.now() - started,
      });
    } finally {
      setRunning(false);
    }
  };

  const successCount = result ? Math.max(0, result.contas - result.erros.length) : 0;
  const successPct = result && result.contas > 0 ? Math.round((successCount / result.contas) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v && !result && !running) runCheck(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-2">
          <Activity className="h-3.5 w-3.5" />
          Diagnóstico API
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Diagnóstico da API Meta
          </DialogTitle>
          <DialogDescription>
            Testa a integração real com a Meta buscando insights das últimas 24h de cada conta e reporta por conta o que retornou 100% e o que falhou.
          </DialogDescription>
        </DialogHeader>

        {running && (
          <div className="py-10 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Consultando Meta Graph API…</p>
          </div>
        )}

        {!running && result && (
          <div className="space-y-4">
            {result.runtimeError ? (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4">
                <div className="flex items-center gap-2 text-destructive font-medium mb-1">
                  <XCircle className="h-4 w-4" /> Falha geral
                </div>
                <p className="text-sm text-destructive/90 break-words">{result.runtimeError}</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-border bg-card/40 p-3">
                    <p className="text-[10px] uppercase text-muted-foreground">Contas</p>
                    <p className="text-2xl font-semibold">{result.contas}</p>
                  </div>
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                    <p className="text-[10px] uppercase text-emerald-300">OK</p>
                    <p className="text-2xl font-semibold text-emerald-300">{successCount}</p>
                  </div>
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                    <p className="text-[10px] uppercase text-destructive">Erros</p>
                    <p className="text-2xl font-semibold text-destructive">{result.erros.length}</p>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Saúde da API</span>
                    <span className={successPct === 100 ? "text-emerald-400 font-medium" : successPct >= 70 ? "text-amber-400 font-medium" : "text-destructive font-medium"}>
                      {successPct}%
                    </span>
                  </div>
                  <Progress value={successPct} className="h-2" />
                </div>

                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">Janela: {result.since} → {result.until}</Badge>
                  <Badge variant="outline">{result.linhas_upsertadas} linha(s) gravada(s)</Badge>
                  <Badge variant="outline">{(result.elapsedMs / 1000).toFixed(1)}s</Badge>
                  {typeof result.aplicativos === "number" && (
                    <Badge variant="outline">{result.aplicativos} app(s) Meta</Badge>
                  )}
                </div>

                {result.ok ? (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-center gap-2 text-emerald-300 text-sm">
                    <CheckCircle2 className="h-4 w-4" /> Todas as contas responderam com sucesso. API 100%.
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <AlertTriangle className="h-4 w-4 text-amber-400" />
                      <span className="font-medium">Contas com falha ({result.erros.length})</span>
                    </div>
                    <ScrollArea className="max-h-72 rounded-lg border border-border">
                      <ul className="divide-y divide-border">
                        {result.erros.map((e, idx) => {
                          const c = classifyError(e.erro);
                          return (
                            <li key={idx} className="p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">{e.account || "Conta sem nome"}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">{c.hint}</p>
                                </div>
                                <Badge variant="destructive" className="shrink-0 text-[10px]">{c.label}</Badge>
                              </div>
                              <details className="mt-2">
                                <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground">
                                  ver mensagem original
                                </summary>
                                <pre className="mt-1 text-[11px] text-muted-foreground whitespace-pre-wrap break-words bg-secondary/40 rounded p-2">
                                  {e.erro}
                                </pre>
                              </details>
                            </li>
                          );
                        })}
                      </ul>
                    </ScrollArea>
                  </div>
                )}
              </>
            )}

            <div className="flex justify-between items-center pt-2 border-t border-border">
              <p className="text-[11px] text-muted-foreground">
                Última verificação: {format(new Date(), "dd/MM/yyyy HH:mm:ss")}
              </p>
              <Button size="sm" variant="outline" onClick={runCheck} disabled={running} className="gap-2">
                <RefreshCw className={running ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
                Testar novamente
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
