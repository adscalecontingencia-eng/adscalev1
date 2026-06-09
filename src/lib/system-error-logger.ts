// Logger global de erros do sistema → audit_log.
// Captura: invocações de edge functions com erro, window.error, unhandledrejection.
// Cada entrada vai com action específica + metadata diagnosticável.
import { supabase } from '@/integrations/supabase/client';

let installed = false;

interface SystemErrorEntry {
  source: string;          // ex: "edge:scan-bm-backups", "window.error"
  message: string;
  stack?: string;
  url?: string;
  payload?: unknown;
  status?: number | string;
  context?: string;
}

function diagnose(msg: string): string {
  const m = (msg || '').toLowerCase();
  if (/access token|jwt|unauthorized|401/.test(m)) return 'Token/sessão inválida. Refaça login ou atualize o token na função.';
  if (/permission|forbidden|403/.test(m)) return 'Sem permissão. Confira role do usuário e RLS da tabela.';
  if (/not found|404/.test(m)) return 'Recurso não encontrado. Verifique IDs e rota da função.';
  if (/rate|limit|429/.test(m)) return 'Rate limit. Aguarde alguns segundos.';
  if (/timeout|timed out|fetch failed|network/.test(m)) return 'Falha de rede. Tente novamente.';
  if (/duplicate|unique/.test(m)) return 'Violação de unicidade no banco. Cheque a chave duplicada.';
  if (/violates row-level/.test(m)) return 'Bloqueado por RLS. Cheque policies da tabela.';
  if (/500|internal/.test(m)) return 'Erro interno na edge function. Veja edge function logs.';
  return 'Cheque o stack e o payload no detalhe.';
}

async function record(action: string, entry: SystemErrorEntry) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('audit_log').insert([{
      actor_id: user?.id ?? null,
      actor_email: user?.email ?? null,
      action,
      entity: 'app',
      metadata: {
        source: entry.source,
        erro: entry.message,
        status: entry.status ?? null,
        url: entry.url ?? (typeof window !== 'undefined' ? window.location.href : null),
        contexto: entry.context ?? null,
        payload: entry.payload ?? null,
        stack: entry.stack?.slice(0, 4000) ?? null,
        solucao_sugerida: diagnose(entry.message),
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        timestamp: new Date().toISOString(),
      } as any,
    }] as any);
  } catch (e) {
    console.warn('[system-error-logger] failed', e);
  }
}

export function installSystemErrorLogger() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  // 1) Monkey-patch supabase.functions.invoke para capturar TODOS os erros de edge
  try {
    const fns: any = (supabase as any).functions;
    const original = fns.invoke.bind(fns);
    fns.invoke = async (name: string, opts?: any) => {
      const res = await original(name, opts);
      if (res?.error) {
        const err: any = res.error;
        record('edge_function_error', {
          source: `edge:${name}`,
          message: err?.message || String(err),
          status: err?.status || err?.context?.status,
          stack: err?.stack,
          payload: opts?.body,
          context: err?.context?.statusText,
        });
      }
      return res;
    };
  } catch (e) {
    console.warn('[system-error-logger] could not patch supabase.functions', e);
  }

  // 2) Erros globais não tratados
  window.addEventListener('error', (ev) => {
    if (!ev?.error && !ev?.message) return;
    record('window_error', {
      source: 'window.error',
      message: ev.error?.message || ev.message || 'Unknown error',
      stack: ev.error?.stack,
      url: (ev as any).filename || window.location.href,
      context: `line ${ev.lineno}:${ev.colno}`,
    });
  });

  // 3) Promises rejeitadas sem catch
  window.addEventListener('unhandledrejection', (ev) => {
    const r: any = ev.reason;
    record('unhandled_promise_rejection', {
      source: 'unhandledrejection',
      message: r?.message || String(r),
      stack: r?.stack,
    });
  });
}
