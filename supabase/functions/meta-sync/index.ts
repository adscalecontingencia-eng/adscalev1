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
    const userTokenRaw = Deno.env.get("META_USER_ACCESS_TOKEN");
    const sysTokenRaw = Deno.env.get("META_SYSTEM_USER_TOKEN");
    const userToken = userTokenRaw?.replace(/\s+/g, "").trim() || "";
    const sysToken = sysTokenRaw?.replace(/\s+/g, "").trim() || "";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    // Route token by action:
    //  - sync_pages prefers System User token (BM-level, permanent, assigned to pages)
    //  - sync_accounts / sync_insights / sync_bms prefer User Access Token (lists all BMs the user admins)
    // Fallback to whichever is available.
    const token = action === "sync_pages"
      ? (sysToken || userToken)
      : (userToken || sysToken);

    if (!token) {
      return json({ erro: "Nenhum token Meta configurado (META_USER_ACCESS_TOKEN ou META_SYSTEM_USER_TOKEN)" }, 500);
    }

    // Diagnostic: returns first/last chars + length without leaking the token
    if (req.url.includes("debug=1")) {
      return json({
        action,
        token_source: action === "sync_pages"
          ? (sysToken ? "META_SYSTEM_USER_TOKEN" : "META_USER_ACCESS_TOKEN (fallback)")
          : (userToken ? "META_USER_ACCESS_TOKEN" : "META_SYSTEM_USER_TOKEN (fallback)"),
        token_length: token.length,
        starts_with: token.slice(0, 6),
        ends_with: token.slice(-6),
        starts_correct: token.startsWith("EAA"),
        has_user_token: !!userToken,
        has_system_token: !!sysToken,
      });
    }

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

      // 1b) Para cada BM, lista contas + contagens — TUDO em paralelo (concorrência limitada)
      const allAccounts: any[] = [];
      const errors: any[] = [];
      const bmCounts = new Map<string, { accounts: number; pixels: number; pages: number }>();

      const ACCOUNT_FIELDS = [
        "id","account_id","name","account_status","currency","amount_spent","spend_cap",
        "timezone_name","created_time","disable_reason","funding_source",
        "funding_source_details","is_prepay_account",
        "balance","business_country_code","age","business",
      ].join(",");

      type Task =
        | { kind: "accounts"; bmId: string; bmName: string; edge: string }
        | { kind: "count"; bmId: string; edge: string };
      const tasks: Task[] = [];
      for (const bm of bms) {
        bmCounts.set(bm.id, { accounts: 0, pixels: 0, pages: 0 });
        for (const e of ["owned_ad_accounts", "client_ad_accounts"]) {
          tasks.push({ kind: "accounts", bmId: bm.id, bmName: bm.name, edge: e });
        }
        for (const e of ["adspixels", "owned_pages", "client_pages"]) {
          tasks.push({ kind: "count", bmId: bm.id, edge: e });
        }
      }

      const CONCURRENCY = 3;
      let cursor = 0;
      const worker = async () => {
        while (true) {
          const i = cursor++;
          if (i >= tasks.length) return;
          const t = tasks[i];
          const url = t.kind === "accounts"
            ? `${META_API}/${t.bmId}/${t.edge}?access_token=${encodeURIComponent(token)}&fields=${ACCOUNT_FIELDS}&limit=200`
            : `${META_API}/${t.bmId}/${t.edge}?access_token=${encodeURIComponent(token)}&fields=id&limit=200`;
          try {
            const items = await paginate(url);
            const c = bmCounts.get(t.bmId)!;
            if (t.kind === "accounts") {
              for (const acc of items) allAccounts.push({ ...acc, _bm_meta_id: t.bmId });
              c.accounts += items.length;
            } else if (t.edge === "adspixels") {
              c.pixels += items.length;
            } else {
              c.pages += items.length;
            }
          } catch (e) {
            if (t.kind === "accounts") errors.push({ bm: t.bmName, edge: t.edge, erro: (e as Error).message });
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, tasks.length) }, worker));

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

      // Mascara o cartão: extrai apenas os 4 últimos dígitos do display_string
      const maskFunding = (acc: any): string | null => {
        const fsd = acc.funding_source_details;
        if (!fsd) return acc.funding_source ? "Vinculado" : null;
        const raw: string = fsd.display_string || "";
        const digits = (raw.match(/\d/g) || []).join("");
        const last4 = digits.slice(-4);
        const type = fsd.type || "";
        const brandMatch = raw.match(/^([A-Za-z]+)/);
        const brand = brandMatch ? brandMatch[1].toUpperCase() : "";
        if (last4) return `${brand || "CARTÃO"} •••• ${last4}`;
        if (type) return type.replace(/_/g, " ");
        return raw || "Vinculado";
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
          funding_source: maskFunding(acc),
          billing_cycle: acc.is_prepay_account === true ? "Pré-paga" : acc.is_prepay_account === false ? "Pós-paga" : null,
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
      const CONCURRENCY = 3;
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

    // ===== 4) SYNC PAGES (BMs -> owned + client pages with details) =====
    if (action === "sync_pages") {
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

      const { data: bmsDb } = await supabase.from("meta_business_managers").select("id, meta_bm_id, name");

      // created_time é restrito quando usado via System User token — removido pra evitar (#100)
      const PAGE_FIELDS = "id,name,category,fan_count,followers_count,picture.type(large),is_published,verification_status";
      const PAGE_FALLBACK_FIELDS = ["id,name,category,picture.type(large)", "id,name", "id"];
      const errors: any[] = [];
      const warnings: any[] = [];
      const detailErrors: any[] = [];
      const allPages: any[] = [];
      const sourceCounts: Record<string, number> = {};
      const sourceModes: Record<string, string> = {};

      const isMetaAccessBlocked = (message: string) =>
        message.includes("API access blocked") ||
        message.includes('"code":200') ||
        message.includes("Permissions error") ||
        message.includes("Unsupported get request");

      const edgeUrl = (ownerId: string, edge: string, fields: string) => {
        const url = new URL(`${META_API}/${ownerId}/${edge}`);
        url.searchParams.set("access_token", token);
        url.searchParams.set("fields", fields);
        url.searchParams.set("limit", "200");
        return url.toString();
      };

      const fetchPagesWithFallback = async (t: { ownerId: string; edge: string; label: string }) => {
        let lastError = "";
        for (const fields of PAGE_FALLBACK_FIELDS) {
          try {
            const items = await paginate(edgeUrl(t.ownerId, t.edge, fields));
            sourceCounts[t.label] = items.length;
            sourceModes[t.label] = "basico";
            return items.map((item: any) => ({ ...item, _partial: true }));
          } catch (e) {
            lastError = (e as Error).message;
            if (!isMetaAccessBlocked(lastError)) break;
          }
        }
        throw new Error(lastError || "Falha ao ler páginas da BM");
      };

      const tasks: { bmDbId: string | null; ownerId: string; edge: string; label: string }[] = [];
      for (const bm of bmsDb || []) {
        for (const e of ["owned_pages", "client_pages"]) {
          tasks.push({ bmDbId: bm.id, ownerId: bm.meta_bm_id, edge: e, label: `bm:${bm.name}/${e}` });
        }
      }
      // Also pull pages from the System User's own profile (outside BMs)
      tasks.push({ bmDbId: null, ownerId: "me", edge: "accounts", label: "me/accounts" });
      // And businesses the user has access to (may catch BMs not yet synced)
      try {
        const myBms = await paginate(`${META_API}/me/businesses?access_token=${encodeURIComponent(token)}&fields=id,name&limit=200`);
        for (const b of myBms) {
          if (!(bmsDb || []).some((x: any) => x.meta_bm_id === b.id)) {
            tasks.push({ bmDbId: null, ownerId: b.id, edge: "owned_pages", label: `bm-extra:${b.name}/owned_pages` });
            tasks.push({ bmDbId: null, ownerId: b.id, edge: "client_pages", label: `bm-extra:${b.name}/client_pages` });
          }
        }
      } catch (e) {
        errors.push({ source: "me/businesses", erro: (e as Error).message });
      }

      const CONCURRENCY = 3;
      let cursor = 0;
      const worker = async () => {
        while (true) {
          const i = cursor++;
          if (i >= tasks.length) return;
          const t = tasks[i];
          try {
            const items = await fetchPagesWithFallback(t);
            for (const p of items) allPages.push({ ...p, _bm_db_id: t.bmDbId });
          } catch (e) {
            errors.push({ source: t.label, erro: (e as Error).message });
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, tasks.length) }, worker));

      // Dedupe by page id
      const seen = new Set<string>();
      const unique = allPages.filter((p) => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });

      const needsDetails = unique.filter((p: any) => p._partial || !p.created_time || p.followers_count == null || p.fan_count == null);
      let detailCursor = 0;
      const detailWorker = async () => {
        while (true) {
          const i = detailCursor++;
          if (i >= needsDetails.length) return;
          const p = needsDetails[i];
          try {
            const details = await metaFetch(`/${p.id}`, token, { fields: PAGE_FIELDS });
            Object.assign(p, details, { _partial: false });
          } catch (e) {
            if (detailErrors.length < 8) detailErrors.push({ page_id: p.id, erro: (e as Error).message });
          }
        }
      };
      if (needsDetails.length > 0) {
        await Promise.all(Array.from({ length: Math.min(5, needsDetails.length) }, detailWorker));
      }

      const rows = unique.map((p: any) => ({
        meta_page_id: p.id,
        bm_id: p._bm_db_id,
        name: p.name || `Página ${p.id}`,
        category: p.category || null,
        fan_count: p.fan_count ?? null,
        followers_count: p.followers_count ?? p.fan_count ?? null,
        created_time: p.created_time || null,
        picture_url: p.picture?.data?.url || null,
        is_published: p.is_published ?? null,
        is_restricted: false,
        status: "active",
        last_synced_at: new Date().toISOString(),
      }));

      if (rows.length > 0) {
        const { error } = await supabase.from("meta_pages").upsert(rows, { onConflict: "meta_page_id" });
        if (error) throw error;
      }

      const apiBlocked = [...errors, ...warnings, ...detailErrors].some((e) => isMetaAccessBlocked(String(e.erro || e.detalhe || "")));
      if (rows.length === 0 && errors.length > 0) {
        return json({
          sucesso: false,
          erro: apiBlocked
            ? "A Meta bloqueou o acesso às páginas das BMs para este token/app. Verifique permissões business_management, pages_show_list e pages_read_engagement no app/token."
            : "Não foi possível puxar páginas das BMs.",
          fontes: sourceCounts,
          modos: sourceModes,
          erros: errors,
        });
      }

      return json({
        sucesso: true,
        paginas_sincronizadas: rows.length,
        fontes: sourceCounts,
        modos: sourceModes,
        avisos: warnings,
        detalhes_bloqueados: detailErrors.length,
        amostras_erros_detalhes: detailErrors,
        erros: errors,
      });
    }

    return json({ erro: "action inválida. Use: sync_bms | sync_accounts | sync_insights | sync_pages" }, 400);
  } catch (err) {
    return json({ erro: (err as Error).message }, 500);
  }
});
