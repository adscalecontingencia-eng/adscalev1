// Edge Function: support-chat
// Assistente de IA 24h do painel do cliente. Responde com contexto real da
// conta (saldo, faturas, contas de anúncio, tickets) e sugere o WhatsApp do
// suporte quando não consegue resolver.
import { createClient } from "npm:@supabase/supabase-js@2";
import { generateResponsesText } from "../_shared/responses.ts";

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

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-6-astra";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const reqId = crypto.randomUUID().slice(0, 8);
  const log = (...a: unknown[]) => console.log(`[support-chat ${reqId}]`, ...a);

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "Assistente indisponível no momento" }, 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : null;
    if (!jwt) return json({ error: "Unauthenticated" }, 401);
    const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: claims } = await anon.auth.getClaims(jwt);
    const uid = claims?.claims?.sub;
    if (!uid) return json({ error: "Unauthenticated" }, 401);

    const body = await req.json().catch(() => ({}));
    const message: string = (body?.message ?? "").toString().trim();
    if (!message || message.length > 2000) {
      return json({ error: "Mensagem inválida (máx. 2000 caracteres)" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: client } = await admin
      .from("clients")
      .select("id, name, email")
      .eq("auth_user_id", uid)
      .maybeSingle();
    if (!client) return json({ error: "Cliente não encontrado" }, 403);

    // Contexto real da conta do cliente
    const [walletRes, invoicesRes, accountsRes, ticketsRes, settingsRes, historyRes] =
      await Promise.all([
        admin.from("wallets").select("balance").eq("client_id", client.id).maybeSingle(),
        admin
          .from("billing_invoices")
          .select("week_start, week_end, amount_usd, status")
          .eq("client_id", client.id)
          .order("week_start", { ascending: false })
          .limit(4),
        admin
          .from("meta_ad_account_assignments")
          .select("id, meta_ad_accounts(account_name, status)")
          .eq("client_id", client.id)
          .limit(20),
        admin
          .from("support_requests")
          .select("subject, status, created_at")
          .eq("client_id", client.id)
          .order("created_at", { ascending: false })
          .limit(5),
        admin.from("support_settings").select("value").eq("key", "support_whatsapp").maybeSingle(),
        admin
          .from("support_chat_messages")
          .select("role, content")
          .eq("client_id", client.id)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

    const whatsapp = String(settingsRes.data?.value ?? "").replace(/"/g, "").trim();

    // Clientes de agência parceira veem só a marca da agência (nunca "AD SCALE").
    const { data: agencyLink } = await admin
      .from("agency_sub_clients")
      .select("agency_client_id")
      .eq("client_id", client.id)
      .order("created_at")
      .limit(1)
      .maybeSingle();
    let brand = "AD SCALE";
    if (agencyLink?.agency_client_id) {
      const { data: st } = await admin
        .from("agency_settings")
        .select("brand_name")
        .eq("agency_client_id", agencyLink.agency_client_id)
        .maybeSingle();
      brand = (st?.brand_name || "").trim() || "sua agência";
    }
    const isAgencyClient = brand !== "AD SCALE";

    const context = {
      cliente: client.name,
      saldo_carteira_usd: walletRes.data?.balance ?? 0,
      ultimas_faturas: invoicesRes.data ?? [],
      contas_de_anuncio: (accountsRes.data ?? []).map((a: any) => ({
        nome: a.meta_ad_accounts?.account_name,
        status: a.meta_ad_accounts?.status,
      })),
      ultimos_tickets: ticketsRes.data ?? [],
      whatsapp_suporte: whatsapp || null,
    };

    const instructions = [
      `Você é o assistente de suporte da ${brand}, uma agência de aluguel de contas de anúncio (Meta Ads).`,
      ...(isAgencyClient ? [`Nunca mencione "AD SCALE" nem outros fornecedores; fale sempre como ${brand}.`] : []),
      "Responda sempre em português brasileiro, de forma curta, clara e amigável (máx. 3 parágrafos).",
      "Use APENAS os dados de contexto abaixo para falar sobre a conta do cliente. Nunca invente valores, saldos ou status.",
      "Você ajuda com: saldo e pagamentos (Pix semanal), faturas, contas de anúncio ativas/bloqueadas, pedidos de novas contas, programa de indicação (US$ 50 de bônus a cada US$ 10.000 gastos pelo indicado) e tickets de suporte.",
      "A semana de cobrança fecha na quinta-feira e é paga na sexta seguinte.",
      "Você NÃO pode executar ações (pagamentos, trocas de senha, pedidos). Para ações, oriente o cliente a usar a aba correspondente do painel.",
      whatsapp
        ? `Quando não souber responder, quando o cliente pedir um humano, ou quando o assunto for urgente (conta bloqueada, pagamento contestado), diga que vai direcionar para o suporte humano e inclua exatamente a palavra [WHATSAPP] na resposta. O número do suporte é ${whatsapp}.`
        : "Quando não souber responder ou o cliente pedir um humano, oriente a abrir um ticket na aba Suporte do painel.",
      "",
      `CONTEXTO DA CONTA (JSON): ${JSON.stringify(context)}`,
    ].join("\n");

    const history = (historyRes.data ?? []).reverse().map((m: any) => ({
      role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
      content: m.role === "agent" ? `[Equipe ${brand} respondeu]: ${m.content}` : (m.content as string),
    }));

    // Salva a mensagem do usuário antes de chamar a IA
    const { error: insErr } = await admin.from("support_chat_messages").insert({
      client_id: client.id,
      user_id: uid,
      role: "user",
      content: message,
    });
    if (insErr) log("falha ao salvar msg do usuário:", insErr.message);

    const { text, runId } = await generateResponsesText(
      req,
      { baseURL: GATEWAY_URL, apiKey, model: MODEL },
      [...history, { role: "user", content: message }],
      instructions,
    );
    log("run:", runId, "resposta:", text.length, "chars");

    const reply = text.trim() ||
      "Desculpe, não consegui responder agora. Tente novamente em instantes ou abra um ticket na aba Suporte.";

    await admin.from("support_chat_messages").insert({
      client_id: client.id,
      user_id: uid,
      role: "assistant",
      content: reply,
    });

    return json({ reply, whatsapp: whatsapp || null });
  } catch (e) {
    log("erro:", e);
    return json({ error: "Erro interno do assistente" }, 500);
  }
});
