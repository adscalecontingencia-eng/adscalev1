import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Copy, QrCode, RefreshCw, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react';

type Invoice = {
  id: string;
  week_start: string;
  week_end: string;
  amount_usd: number;
  amount_brl: number | null;
  fx_rate: number | null;
  qr_code: string | null;
  qr_code_base64: string | null;
  ticket_url: string | null;
  status: string;
  due_date: string | null;
  paid_at: string | null;
};

const fmtDate = (d?: string | null) => {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

export default function WeeklyInvoiceCard({ clientId }: { clientId: string }) {
  const { t } = useTranslation();
  const [current, setCurrent] = useState<Invoice | null>(null);
  const [history, setHistory] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('billing_invoices')
      .select('id, week_start, week_end, amount_usd, amount_brl, fx_rate, qr_code, qr_code_base64, ticket_url, status, due_date, paid_at')
      .eq('client_id', clientId)
      .order('week_start', { ascending: false })
      .limit(20);
    const rows = (data ?? []) as Invoice[];
    setCurrent(rows.find((r) => r.status === 'aberta' || r.status === 'vencida') ?? null);
    setHistory(rows);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  const copyPix = async () => {
    if (!current?.qr_code) return;
    await navigator.clipboard.writeText(current.qr_code);
    toast.success(t('invoice.copied', 'Código Pix copiado'));
  };

  const checkPayment = async () => {
    if (!current) return;
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke('billing-invoice-status', {
        body: { invoice_id: current.id },
      });
      if (error) throw error;
      if ((data as any)?.status === 'paga') {
        toast.success(t('invoice.confirmed', 'Pagamento confirmado!'));
      } else {
        toast.info(t('invoice.notYet', 'Ainda não identificamos o pagamento. Tente em alguns minutos.'));
      }
      await load();
    } catch (e: any) {
      toast.error(e?.message || t('invoice.checkError', 'Erro ao consultar pagamento'));
    } finally {
      setChecking(false);
    }
  };

  if (loading) {
    return <div className="rounded-2xl border border-border/50 bg-card p-5 animate-pulse h-32" />;
  }

  const overdue = current?.status === 'vencida';

  return (
    <div className="space-y-4">
      <div
        className={`rounded-2xl p-5 border bg-card ${
          overdue ? 'border-destructive/50 shadow-[0_0_30px_-10px_hsl(var(--destructive)/0.4)]' : 'border-border/60'
        }`}
      >
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2">
              <QrCode className="h-4 w-4 text-primary" />
              {t('invoice.title', 'Fatura da semana')}
            </h3>
            {current ? (
              <p className="text-xs text-muted-foreground mt-1">
                {fmtDate(current.week_start)} — {fmtDate(current.week_end)} ·{' '}
                {t('invoice.due', 'Vencimento')}: {fmtDate(current.due_date)}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                {t('invoice.none', 'Nenhuma fatura em aberto no momento.')}
              </p>
            )}
          </div>
          {current && (
            <Badge variant={overdue ? 'destructive' : 'secondary'}>
              {overdue ? t('invoice.overdue', 'Vencida') : t('invoice.open', 'Em aberto')}
            </Badge>
          )}
        </div>

        {current && (
          <>
            <div className="mt-4 flex items-end gap-4 flex-wrap">
              <div>
                <p className="text-xs text-muted-foreground">{t('invoice.amountUsd', 'Valor (USD)')}</p>
                <p className="text-2xl font-bold text-primary">
                  ${Number(current.amount_usd).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
              {current.amount_brl != null && (
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t('invoice.amountBrl', 'Valor em reais')}{' '}
                    {current.fx_rate ? `(${Number(current.fx_rate).toFixed(4)})` : ''}
                  </p>
                  <p className="text-lg font-semibold">
                    R$ {Number(current.amount_brl).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              )}
            </div>

            {overdue && (
              <p className="mt-3 text-xs text-destructive flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                {t('invoice.overdueHint', 'Esta fatura está vencida. Pague o quanto antes para evitar interrupções.')}
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {!current.qr_code ? (
                <Button size="sm" onClick={generatePix} disabled={generating}>
                  <QrCode className={`h-4 w-4 mr-1.5 ${generating ? 'animate-pulse' : ''}`} />
                  {generating
                    ? t('invoice.generating', 'Gerando Pix...')
                    : t('invoice.generatePix', 'Gerar Pix (QR Code e copia e cola)')}
                </Button>
              ) : (
                <>
                  <Button size="sm" onClick={copyPix}>
                    <Copy className="h-4 w-4 mr-1.5" />
                    {t('invoice.copyPix', 'Copiar código Pix')}
                  </Button>
                  {current.qr_code_base64 && (
                    <Button size="sm" variant="outline" onClick={() => setShowQr((v) => !v)}>
                      <QrCode className="h-4 w-4 mr-1.5" />
                      {showQr ? t('invoice.hideQr', 'Ocultar QR Code') : t('invoice.showQr', 'Ver QR Code')}
                    </Button>
                  )}
                  {current.ticket_url && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={current.ticket_url} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4 mr-1.5" />
                        {t('invoice.openCharge', 'Abrir cobrança')}
                      </a>
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={checkPayment} disabled={checking}>
                    <RefreshCw className={`h-4 w-4 mr-1.5 ${checking ? 'animate-spin' : ''}`} />
                    {t('invoice.alreadyPaid', 'Já paguei')}
                  </Button>
                </>
              )}
            </div>
            {!current.qr_code && (
              <p className="mt-2 text-xs text-muted-foreground">
                {t('invoice.generateHint', 'O código Pix é gerado apenas quando você clicar no botão acima.')}
              </p>
            )}


            {showQr && current.qr_code_base64 && (
              <div className="mt-4 bg-white p-3 rounded-xl w-fit">
                <img
                  src={`data:image/png;base64,${current.qr_code_base64}`}
                  alt={t('invoice.qrAlt', 'QR Code Pix da fatura semanal')}
                  className="w-48 h-48"
                />
              </div>
            )}
          </>
        )}
      </div>

      {history.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <h4 className="text-sm font-semibold mb-3">{t('invoice.history', 'Histórico de faturas')}</h4>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {history.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between text-sm border-b border-border/40 pb-2">
                <div>
                  <p className="font-medium">
                    {fmtDate(inv.week_start)} — {fmtDate(inv.week_end)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ${Number(inv.amount_usd).toFixed(2)}
                    {inv.amount_brl != null ? ` · R$ ${Number(inv.amount_brl).toFixed(2)}` : ''}
                  </p>
                </div>
                {inv.status === 'paga' ? (
                  <span className="text-xs text-primary flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {t('invoice.paid', 'Paga')} {inv.paid_at ? new Date(inv.paid_at).toLocaleDateString() : ''}
                  </span>
                ) : (
                  <Badge variant={inv.status === 'vencida' ? 'destructive' : 'outline'} className="text-[10px]">
                    {inv.status}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
