// Edge Function: billing-generate-invoices
// Gera faturas semanais (Pix / Mercado Pago) com o total em aberto de cada cliente,
// envia e-mail com o QR Code, dispara lembretes e marca faturas vencidas.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isTestMode() {
  const env = (Deno.env.get("MERCADO_PAGO_ENV") || "test").trim().toLowerCase();
  return !["live", "production", "prod"].includes(env);
}

function mpToken() {
  return isTestMode()
    ? Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN_TEST")
    : Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN_LIVE");
}

// Data local de São Paulo (UTC-3) em YYYY-MM-DD
function brtToday(): Date {
  const now = new Date();
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  return new Date(Date.UTC(brt.getUTCFullYear(), brt.getUTCMonth(), brt.getUTCDate()));
}

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number) {
  const c = new Date(d);
  c.setUTCDate(c.getUTCDate() + n);
  return c;
}

function fmtBR(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

async function fetchFxRate(marginPct: number): Promise<number> {
  const sources = [
    async () => {
      const r = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL");
      const d = await r.json();
      return Number(d?.USDBRL?.bid);
    },
    async () => {
      const r = await fetch("https://open.er-api.com/v6/latest/USD");
      const d = await r.json();
      return Number(d?.rates?.BRL);
    },
  ];
  for (const src of sources) {
    try {
      const v = await src();
      if (v && v > 0) return Number((v * (1 + marginPct / 100)).toFixed(6));
    } catch (_) { /* tenta próxima fonte */ }
  }
  throw new Error("Não foi possível obter a cotação do dólar");
}

function invoiceEmail(opts: {
  name: string;
  amountUsd: number;
  amountBrl: number;
  fxRate: number;
  weekStart: string;
  weekEnd: string;
  dueDate: string;
  qrCode: string | null;
  ticketUrl: string | null;
  reminder: boolean;
}) {
  const title = opts.reminder ? "Lembrete: fatura em aberto" : "Fatura da semana AD•SCALE";
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#111">
      <h2>${title}</h2>
      <p>Olá, ${opts.name}.</p>
      <p>Semana de <strong>${fmtBR(opts.weekStart)}</strong> a <strong>${fmtBR(opts.weekEnd)}</strong>.</p>
      <p style="font-size:20px"><strong>US$ ${opts.amountUsd.toFixed(2)}</strong>
        &nbsp;•&nbsp; R$ ${opts.amountBrl.toFixed(2)} (cotação ${opts.fxRate.toFixed(4)})</p>
      <p>Vencimento: <strong>${fmtBR(opts.dueDate)}</strong></p>
      ${opts.qrCode ? `<p>Código Pix copia e cola:</p>
      <pre style="white-space:pre-wrap;word-break:break-all;background:#f4f4f5;padding:12px;border-radius:8px;font-size:12px">${opts.qrCode}</pre>` : ""}
      ${opts.ticketUrl ? `<p><a href="${opts.ticketUrl}" style="background:#16a34a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Abrir cobrança Pix</a></p>` : ""}
      <p style="color:#666;font-size:12px">Você também pode pagar direto pelo painel, em "Fatura da semana".</p>
    </div>`;
  const text = `${title}\nSemana ${fmtBR(opts.weekStart)} a ${fmtBR(opts.weekEnd)}\nUS$ ${opts.amountUsd.toFixed(2)} (R$ ${opts.amountBrl.toFixed(2)})\nVencimento: ${fmtBR(opts.dueDate)}\n${opts.qrCode ?? ""}`;
  return { subject: `${title} — US$ ${opts.amountUsd.toFixed(2)}`, html, text };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const reqId = crypto.randomUUID().slice(0, 8);
  const log = (...a: unknown[]) => console.log(`[billing-invoices ${reqId}]`, ...a);

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const mode: string = body?.mode ?? "auto"; // auto | generate | reminders | single
    const singleClientId: string | null = body?.client_id ?? null;

    // Chamada manual do painel exige admin/support; cron usa service role sem Authorization de usuário.
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : null;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (jwt && jwt !== serviceKey) {
      const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
      const { data: claims } = await anon.auth.getClaims(jwt);
      const uid = claims?.claims?.sub;
      if (!uid) return json({ error: "Unauthenticated" }, 401);
      const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", uid);
      const ok = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "support");
      if (!ok) return json({ error: "Forbidden" }, 403);
    }

    const token = mpToken();
    if (!token) return json({ error: "Mercado Pago token ausente" }, 500);

    const today = brtToday();
    const dow = today.getUTCDay(); // 5 = sexta
    const weekEnd = addDays(today, -1);
    const weekStart = addDays(today, -7);
    const dueDate = addDays(today, 6);

    const shouldGenerate = mode === "generate" || mode === "single" || (mode === "auto" && dow === 5);

    // Margem de câmbio configurável
    const { data: setting } = await admin
      .from("support_settings")
      .select("value")
      .eq("key", "billing_fx_margin_pct")
      .maybeSingle();
    const marginPct = Number(setting?.value ?? 2) || 0;

    const result = { generated: 0, skipped: 0, reminders: 0, expired: 0, errors: [] as string[] };

    // 1) Marca faturas vencidas
    const { data: expired } = await admin
      .from("billing_invoices")
      .update({ status: "vencida" })
      .eq("status", "aberta")
      .lt("due_date", iso(today))
      .select("id");
    result.expired = expired?.length ?? 0;

    if (shouldGenerate) {
      const fxRate = await fetchFxRate(marginPct);
      log("fx", { fxRate, marginPct });

      let clientQuery = admin
        .from("clients")
        .select("id, name, email, status")
        .neq("status", "inativo");
      if (singleClientId) clientQuery = admin.from("clients").select("id, name, email, status").eq("id", singleClientId);
      const { data: clients, error: clientsErr } = await clientQuery;
      if (clientsErr) throw clientsErr;

      for (const client of clients ?? []) {
        try {
          // Já existe fatura da semana?
          const { data: existing } = await admin
            .from("billing_invoices")
            .select("id, status")
            .eq("client_id", client.id)
            .eq("week_start", iso(weekStart))
            .maybeSingle();
          if (existing) { result.skipped++; continue; }

          // Total em aberto (comissões pendentes acumuladas)
          const { data: comms } = await admin
            .from("commissions")
            .select("valor_pendente")
            .eq("client_id", client.id)
            .gt("valor_pendente", 0);
          const amountUsd = Number(
            (comms ?? []).reduce((s: number, c: any) => s + Number(c.valor_pendente || 0), 0).toFixed(2),
          );
          if (amountUsd < 1) { result.skipped++; continue; }

          // Faturas anteriores em aberto/vencidas são substituídas por esta
          await admin
            .from("billing_invoices")
            .update({ status: "substituida" })
            .eq("client_id", client.id)
            .in("status", ["aberta", "vencida"]);

          const amountBrl = Number((amountUsd * fxRate).toFixed(2));
          const externalReference = `inv-${client.id.slice(0, 8)}-${iso(weekStart)}-${crypto.randomUUID().slice(0, 6)}`;

          // O Pix (QR Code / copia e cola) é gerado sob demanda pelo cliente no painel.
          const { data: inv, error: insErr } = await admin
            .from("billing_invoices")
            .insert({
              client_id: client.id,
              week_start: iso(weekStart),
              week_end: iso(weekEnd),
              amount_usd: amountUsd,
              fx_rate: fxRate,
              amount_brl: amountBrl,
              external_reference: externalReference,
              status: "aberta",
              due_date: iso(dueDate),
            })
            .select("id, qr_code, ticket_url")
            .single();

          if (insErr) { result.errors.push(`${client.name}: ${insErr.message}`); continue; }

          if (client.email) {
            const mail = invoiceEmail({
              name: client.name ?? "cliente",
              amountUsd, amountBrl, fxRate,
              weekStart: iso(weekStart), weekEnd: iso(weekEnd), dueDate: iso(dueDate),
              qrCode: inv.qr_code, ticketUrl: inv.ticket_url, reminder: false,
            });
            await admin.rpc("enqueue_email", {
              queue_name: "transactional_emails",
              payload: {
                to: client.email,
                subject: mail.subject,
                html: mail.html,
                text: mail.text,
                purpose: "transactional",
                label: "weekly-invoice",
                idempotency_key: `invoice-${inv.id}`,
                message_id: `invoice-${inv.id}`,
                queued_at: new Date().toISOString(),
              },
            });
          }
          result.generated++;
        } catch (e) {
          result.errors.push(`${client.name}: ${(e as Error).message}`);
        }
      }
    }

    // 2) Lembretes: faturas abertas com 1+ dia e no máximo 3 lembretes
    if (mode === "auto" || mode === "reminders") {
      const { data: open } = await admin
        .from("billing_invoices")
        .select("id, client_id, amount_usd, amount_brl, fx_rate, week_start, week_end, due_date, qr_code, ticket_url, reminders_sent, last_reminder_at, created_at, clients(name, email)")
        .eq("status", "aberta")
        .lt("reminders_sent", 3);

      for (const inv of (open ?? []) as any[]) {
        const last = inv.last_reminder_at ? new Date(inv.last_reminder_at) : new Date(inv.created_at);
        const hours = (Date.now() - last.getTime()) / 36e5;
        if (hours < 40) continue;
        const email = inv.clients?.email;
        if (!email) continue;
        const mail = invoiceEmail({
          name: inv.clients?.name ?? "cliente",
          amountUsd: Number(inv.amount_usd),
          amountBrl: Number(inv.amount_brl ?? 0),
          fxRate: Number(inv.fx_rate ?? 0),
          weekStart: inv.week_start, weekEnd: inv.week_end, dueDate: inv.due_date,
          qrCode: inv.qr_code, ticketUrl: inv.ticket_url, reminder: true,
        });
        await admin.rpc("enqueue_email", {
          queue_name: "transactional_emails",
          payload: {
            to: email,
            subject: mail.subject,
            html: mail.html,
            text: mail.text,
            purpose: "transactional",
            label: "weekly-invoice-reminder",
            idempotency_key: `invoice-${inv.id}-r${inv.reminders_sent + 1}`,
            message_id: `invoice-${inv.id}-r${inv.reminders_sent + 1}`,
            queued_at: new Date().toISOString(),
          },
        });
        await admin
          .from("billing_invoices")
          .update({ reminders_sent: inv.reminders_sent + 1, last_reminder_at: new Date().toISOString() })
          .eq("id", inv.id);
        result.reminders++;
      }
    }

    log("done", result);
    return json({ ok: true, mode, week_start: iso(weekStart), week_end: iso(weekEnd), ...result });
  } catch (err) {
    console.error("billing-generate-invoices error", err);
    return json({ error: (err as Error).message }, 500);
  }
});
