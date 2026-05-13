// Meta Marketing API sync — pulls BMs, ad accounts and daily insights
// Endpoints (POST):
//   { action: "sync_bms" }                    -> sync all Business Managers
//   { action: "sync_accounts", bm_id?: uuid } -> sync ad accounts for a BM (or all)
//   { action: "sync_insights", date?: "YYYY-MM-DD" } -> sync daily insights for all accounts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const META_API = "https://graph.facebook.com/v21.0";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function metaFetch(path: string, token: string, params: Record<string, string> = {}) {
  const url = new URL(`${META_API}${path}`);
  url.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(`Meta API error: ${JSON.stringify(data.error || data)}`);
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ erro: "Use POST" }, 405);

  try {
    const rawToken = Deno.env.get("META_SYSTEM_USER_TOKEN");
    const token = rawToken?.replace(/\s+/g, "").trim();
    if (!token) return json({ erro: "META_SYSTEM_USER_TOKEN não configurado" }, 500);

    // Diagnostic: returns first/last chars + length without leaking the token
    if (req.url.includes("debug=1")) {
      return json({
        token_length: token.length,
        starts_with: token.slice(0, 6),
        ends_with: token.slice(-6),
        starts_correct: token.startsWith("EAA"),
        raw_length: rawToken?.length,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    // ===== 1) SYNC BMs + ACCOUNTS (User Token: list BMs then accounts of each) =====
    if (action === "sync_bms" || action === "sync_accounts") {
      // Helper: paginate any /edge URL
      const paginate = async (firstUrl: string) => {
        const out: any[] = [];
        let url: string | null = firstUrl;
        while (url) {
          const r = await fetch(url);
          const d = await r.json();
          if (!r.ok || d.error) throw new Error(`Meta API error: ${JSON.stringify(d.error || d)}`);
          out.push(...(d.data || []));
          url = d.paging?.next || null;
        }
        return out;
      };

      // 1a) List all BMs the user admins
      const bms = await paginate(
        `${META_API}/me/businesses?access_token=${encodeURIComponent(token)}&fields=id,name,verification_status&limit=200`
      );

      if (bms.length === 0) {
        return json({
          sucesso: true,
          sincronizadas: 0,
          hint: "Nenhuma Business Manager encontrada. Verifique se este token pertence ao usuário admin das BMs.",
        });
      }

      // Quick mode: only sync BMs (skip accounts) — use sync_accounts to fetch accounts
      if (action === "sync_bms") {
        const bmRowsQuick = bms.map((bm: any) => ({
          meta_bm_id: bm.id,
          name: bm.name,
          status: bm.verification_status || "active",
          last_synced_at: new Date().toISOString(),
        }));
        await supabase.from("meta_business_managers")
          .upsert(bmRowsQuick, { onConflict: "meta_bm_id" });
        return json({
          sucesso: true,
          bms_sincronizadas: bmRowsQuick.length,
          bms: bmRowsQuick.map((b) => b.name),
          proximo_passo: "Rode action=sync_accounts para puxar as contas de anúncio.",
        });
      }

      // Upsert BMs
      const bmRows = bms.map((bm: any) => ({
        meta_bm_id: bm.id,
        name: bm.name,
        status: bm.verification_status || "active",
        last_synced_at: new Date().toISOString(),
      }));
      const { error: bmErr } = await supabase.from("meta_business_managers")
        .upsert(bmRows, { onConflict: "meta_bm_id" });
      if (bmErr) throw bmErr;

      const { data: bmsDb } = await supabase.from("meta_business_managers")
        .select("id, meta_bm_id");
      const bmIdMap = new Map((bmsDb || []).map((b: any) => [b.meta_bm_id, b.id]));

      // 1b) For each BM, list owned + client ad accounts (com campos detalhados) + contagens (pixels/pages)
      const allAccounts: any[] = [];
      const errors: any[] = [];
      const bmCounts = new Map<string, { accounts: number; pixels: number; pages: number }>();

      const ACCOUNT_FIELDS = [
        "id","account_id","name","account_status","currency","amount_spent","spend_cap",
        "timezone_name","created_time","disable_reason","funding_source",
        "balance","business_country_code","age","business",
      ].join(",");

      for (const bm of bms) {
        const counts = { accounts: 0, pixels: 0, pages: 0 };
        for (const edge of ["owned_ad_accounts", "client_ad_accounts"]) {
          try {
            const accs = await paginate(
              `${META_API}/${bm.id}/${edge}?access_token=${encodeURIComponent(token)}&fields=${ACCOUNT_FIELDS}&limit=200`
            );
            for (const acc of accs) allAccounts.push({ ...acc, _bm_meta_id: bm.id });
            counts.accounts += accs.length;
          } catch (e) {
            errors.push({ bm: bm.name, edge, erro: (e as Error).message });
          }
        }
        // Pixels & pages owned by BM (best-effort, falhas não bloqueiam)
        for (const edge of ["adspixels", "owned_pages", "client_pages"]) {
          try {
            const items = await paginate(
              `${META_API}/${bm.id}/${edge}?access_token=${encodeURIComponent(token)}&fields=id&limit=200`
            );
            if (edge === "adspixels") counts.pixels += items.length;
            else counts.pages += items.length;
          } catch { /* ignore */ }
        }
        bmCounts.set(bm.id, counts);
      }

      // Dedupe by meta_account_id
      const seen = new Set<string>();
      const unique = allAccounts.filter((a) => {
        if (seen.has(a.id)) return false;
        seen.add(a.id);
        return true;
      });

      // Tabela oficial Meta de disable_reason
      // https://developers.facebook.com/docs/marketing-api/reference/ad-account/
      const DISABLE_REASONS: Record<number, string> = {
        0: "Nenhum",
        1: "ADS_INTEGRITY_POLICY",
        2: "ADS_IP_REVIEW",
        3: "RISK_PAYMENT",
        4: "GRAY_ACCOUNT_SHUT_DOWN",
        5: "ADS_AFC_REVIEW",
        6: "BUSINESS_INTEGRITY_RAR",
        7: "PERMANENT_CLOSE",
        8: "UNUSED_RESELLER_ACCOUNT",
        9: "UNUSED_ACCOUNT",
        10: "UMBRELLA_AD_ACCOUNT",
        11: "BUSINESS_MANAGER_INTEGRITY_POLICY",
        12: "MISREPRESENTED_AD_ACCOUNT",
        13: "AOAB_DESHARE_LEGAL_ENTITY",
        14: "CTX_THREAD_REVIEW",
        15: "COMPROMISED_AD_ACCOUNT",
      };

      const bmStatusMap = new Map(bms.map((b: any) => [b.id, b.verification_status]));

      // Score (0-100) baseado em sinais oficiais do Meta
      const computeScore = (acc: any) => {
        let s = 100;
        const reasons: string[] = [];
        if (acc.account_status !== 1) { s -= 60; reasons.push("Conta não ativa"); }
        if (acc.disable_reason && acc.disable_reason !== 0) { s -= 40; reasons.push("Bloqueio ativo"); }
        if (!acc.funding_source) { s -= 20; reasons.push("Sem pagamento vinculado"); }
        const bmVer = bmStatusMap.get(acc._bm_meta_id);
        if (bmVer && bmVer !== "verified") { s -= 10; reasons.push("BM não verificada"); }
        if (!acc.amount_spent || Number(acc.amount_spent) === 0) { s -= 5; reasons.push("Sem histórico de gasto"); }
        s = Math.max(0, Math.min(100, s));
        const label = s >= 80 ? "Excelente" : s >= 60 ? "Bom" : s >= 40 ? "Atenção" : "Crítico";
        return { score: s, label, reasons };
      };

      const accRows = unique.map((acc: any) => {
        const { score, label } = computeScore(acc);
        return {
          meta_account_id: acc.id,
          bm_id: bmIdMap.get(acc._bm_meta_id) || null,
          name: acc.name,
          account_status: acc.account_status,
          status: acc.account_status === 1 ? "active" : "blocked",
          currency: acc.currency || "USD",
          amount_spent: acc.amount_spent ? Number(acc.amount_spent) / 100 : 0,
          spend_cap: acc.spend_cap ? Number(acc.spend_cap) / 100 : null,
          timezone_name: acc.timezone_name || null,
          account_created_time: acc.created_time || null,
          disable_reason: acc.disable_reason ?? null,
          disable_reason_label: acc.disable_reason ? (DISABLE_REASONS[acc.disable_reason] || `Código ${acc.disable_reason}`) : DISABLE_REASONS[0],
          funding_source: acc.funding_source || null,
          balance: acc.balance ? Number(acc.balance) / 100 : 0,
          business_country_code: acc.business_country_code || null,
          age: acc.age ?? null,
          owner_business_name: acc.business?.name || null,
          score,
          score_label: label,
          last_synced_at: new Date().toISOString(),
        };
      });

      if (accRows.length > 0) {
        const { error: accErr } = await supabase.from("meta_ad_accounts")
          .upsert(accRows, { onConflict: "meta_account_id" });
        if (accErr) throw accErr;
      }

      // Atualiza contadores e verification_status nas BMs
      const bmUpdates = bms.map((bm: any) => {
        const c = bmCounts.get(bm.id) || { accounts: 0, pixels: 0, pages: 0 };
        return {
          meta_bm_id: bm.id,
          name: bm.name,
          status: bm.verification_status || "active",
          verification_status: bm.verification_status || null,
          account_count: c.accounts,
          pixel_count: c.pixels,
          page_count: c.pages,
          last_synced_at: new Date().toISOString(),
        };
      });
      if (bmUpdates.length > 0) {
        await supabase.from("meta_business_managers")
          .upsert(bmUpdates, { onConflict: "meta_bm_id" });
      }

      return json({
        sucesso: true,
        bms_sincronizadas: bmRows.length,
        contas_sincronizadas: accRows.length,
        bms: bmRows.map((b) => b.name),
        erros: errors,
      });
    }

    // ===== 3) SYNC DAILY INSIGHTS (range, paralelo) =====
    if (action === "sync_insights") {
      const yday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const since: string = body.since || body.date || yday;
      const until: string = body.until || body.date || yday;

      const { data: accounts, error: accErr } = await supabase
        .from("meta_ad_accounts")
        .select("id, meta_account_id, name");
      if (accErr) throw accErr;

      const purchaseTypes = ["purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase"];
      const sumByType = (arr: any[]) =>
        (arr || [])
          .filter((a) => purchaseTypes.includes(a.action_type))
          .reduce((s: number, a: any) => s + Number(a.value || 0), 0);

      const errors: any[] = [];
      let totalRows = 0;

      // Concurrency limiter
      const CONCURRENCY = 8;
      const list = accounts || [];
      let idx = 0;
      const allRows: any[] = [];

      const worker = async () => {
        while (true) {
          const i = idx++;
          if (i >= list.length) return;
          const acc = list[i];
          try {
            const data = await metaFetch(`/${acc.meta_account_id}/insights`, token, {
              fields: "spend,impressions,clicks,cpm,cpc,ctr,reach,actions,action_values",
              time_range: JSON.stringify({ since, until }),
              level: "account",
              time_increment: "1",
              limit: "500",
            });
            for (const row of data.data || []) {
              allRows.push({
                ad_account_id: acc.id,
                date: row.date_start,
                spend: Number(row.spend || 0),
                impressions: Number(row.impressions || 0),
                clicks: Number(row.clicks || 0),
                cpm: Number(row.cpm || 0),
                cpc: Number(row.cpc || 0),
                ctr: Number(row.ctr || 0),
                reach: Number(row.reach || 0),
                actions: row.actions || null,
                purchases: sumByType(row.actions),
                revenue: sumByType(row.action_values),
              });
            }
          } catch (e) {
            errors.push({ account: acc.name, erro: (e as Error).message });
          }
        }
      };

      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, list.length) }, worker));

      // Bulk upsert in chunks
      const CHUNK = 500;
      for (let i = 0; i < allRows.length; i += CHUNK) {
        const chunk = allRows.slice(i, i + CHUNK);
        const { error } = await supabase
          .from("meta_ad_insights")
          .upsert(chunk, { onConflict: "ad_account_id,date" });
        if (error) throw error;
        totalRows += chunk.length;
      }

      return json({
        sucesso: true,
        since,
        until,
        contas: list.length,
        linhas_upsertadas: totalRows,
        erros: errors,
      });
    }

    return json({ erro: "action inválida. Use: sync_bms | sync_accounts | sync_insights" }, 400);
  } catch (err) {
    return json({ erro: (err as Error).message }, 500);
  }
});
