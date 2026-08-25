import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const money = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function buildEmail(kind: string, opts: {
  partnerName: string; referredName: string; bonus: number; remaining: number; paid: number; target: number;
}) {
  const isAwarded = kind === 'awarded';
  const subject = isAwarded
    ? `🎉 Você ganhou US$ ${money(opts.bonus)} em crédito de indicação`
    : `Faltam US$ ${money(opts.remaining)} para o seu próximo bônus de US$ ${money(opts.bonus)}`;

  const headline = isAwarded ? 'Bônus de indicação liberado!' : 'Seu próximo bônus está chegando';
  const body = isAwarded
    ? `A meta de US$ ${money(opts.target)} pagos por <strong>${opts.referredName}</strong> foi atingida e US$ ${money(opts.bonus)} em crédito entraram no seu extrato.`
    : `<strong>${opts.referredName}</strong> já pagou US$ ${money(opts.paid)} à agência. Faltam <strong>US$ ${money(opts.remaining)}</strong> para você receber mais <strong>US$ ${money(opts.bonus)}</strong> em crédito.`;

  const html = `<!doctype html><html><body style="margin:0;background:#0b0f0c;font-family:Arial,Helvetica,sans-serif;color:#e6f2e9">
  <div style="max-width:560px;margin:0 auto;padding:28px">
    <div style="font-size:12px;letter-spacing:4px;color:#8ef0a5;text-transform:uppercase">AD SCALE</div>
    <div style="margin-top:18px;border:1px solid #1f3a29;border-radius:16px;background:#101a13;padding:24px">
      <h1 style="margin:0 0 12px;font-size:20px;color:#ffffff">${headline}</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#c8d8cd">Olá ${opts.partnerName},</p>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#c8d8cd">${body}</p>
      <div style="background:#0e2417;border:1px solid #2c6b45;border-radius:12px;padding:16px;text-align:center">
        <div style="font-size:11px;letter-spacing:2px;color:#8ef0a5;text-transform:uppercase">Crédito estimado</div>
        <div style="font-size:26px;font-weight:bold;color:#ffffff;margin-top:6px">US$ ${money(opts.bonus)}</div>
      </div>
      <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#9db1a4">Acompanhe todos os créditos no extrato do programa de indicação, dentro do seu painel.</p>
    </div>
    <p style="margin:18px 0 0;font-size:11px;color:#6d8177">Você recebeu este aviso porque participa do programa de indicação da AD Scale.</p>
  </div></body></html>`;

  const text = `${headline}\n\n${body.replace(/<[^>]+>/g, '')}\n\nCrédito estimado: US$ ${money(opts.bonus)}`;
  return { subject, html, text };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // 1. Detect partners approaching the next milestone (creates alert rows)
    const { data: detected, error: detectError } = await supabase.rpc('detect_referral_milestone_alerts', {
      _threshold_pct: 70,
    });
    if (detectError) throw detectError;

    // 2. Pick alerts that were never emailed
    const { data: alerts, error: alertsError } = await supabase
      .from('referral_alerts')
      .select('id, kind, milestone_index, estimated_amount, remaining_amount, referrer_client_id, referred_client_id')
      .is('emailed_at', null)
      .order('created_at', { ascending: true })
      .limit(50);
    if (alertsError) throw alertsError;

    let queued = 0;
    for (const alert of alerts ?? []) {
      const { data: partner } = await supabase
        .from('clients').select('name, email').eq('id', alert.referrer_client_id).maybeSingle();
      if (!partner?.email) {
        await supabase.from('referral_alerts').update({ emailed_at: new Date().toISOString() }).eq('id', alert.id);
        continue;
      }
      const { data: referred } = await supabase
        .from('clients').select('name').eq('id', alert.referred_client_id).maybeSingle();

      const { data: paidRows } = await supabase
        .from('commissions').select('valor_pago').eq('client_id', alert.referred_client_id);
      const paid = (paidRows ?? []).reduce((s: number, r: any) => s + Number(r.valor_pago || 0), 0);

      const { subject, html, text } = buildEmail(alert.kind, {
        partnerName: partner.name || 'parceiro',
        referredName: referred?.name || 'seu indicado',
        bonus: Number(alert.estimated_amount || 50),
        remaining: Number(alert.remaining_amount || 0),
        paid,
        target: Number(alert.milestone_index || 1) * 1000,
      });

      const messageId = `referral-alert-${alert.id}`;
      const { error: queueError } = await supabase.rpc('enqueue_email', {
        queue_name: 'transactional_emails',
        payload: {
          to: partner.email,
          subject,
          html,
          text,
          purpose: 'transactional',
          label: 'referral-alert',
          idempotency_key: messageId,
          message_id: messageId,
          queued_at: new Date().toISOString(),
        },
      });
      if (queueError) {
        console.error('enqueue failed', queueError);
        continue;
      }

      await supabase.from('email_send_log').insert({
        message_id: messageId,
        template_name: 'referral-alert',
        recipient_email: partner.email,
        status: 'pending',
      });
      await supabase.from('referral_alerts').update({ emailed_at: new Date().toISOString() }).eq('id', alert.id);
      queued++;
    }

    return new Response(JSON.stringify({ ok: true, detected, queued }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('referral-alerts error', e);
    return new Response(JSON.stringify({ ok: false, error: 'internal_error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
