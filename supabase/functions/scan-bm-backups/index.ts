// Varre todas as BMs ativas, lista usuários via Graph API, salva cache em bm_detected_users
// e auto-sincroniza bm_backup_assignments a partir do meta_user_whitelist (perfil ↔ backup).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const GRAPH = "https://graph.facebook.com/v21.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ erro: "Use POST" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ erro: "Não autenticado" }, 401);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ erro: "Não autenticado" }, 401);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    const ok = (roles || []).some((r: any) => r.role === "admin" || r.role === "support");
    if (!ok) return json({ erro: "Acesso negado" }, 403);

    // Token Meta
    let token = Deno.env.get("META_SYSTEM_USER_TOKEN") || Deno.env.get("META_USER_ACCESS_TOKEN");
    const { data: app } = await admin.from("meta_apps").select("system_user_token,user_access_token").order("created_at",{ascending:false}).limit(1).maybeSingle();
    if (app?.system_user_token) token = app.system_user_token;
    else if (app?.user_access_token) token = app.user_access_token;
    if (!token) return json({ erro: "Sem token Meta configurado" }, 400);

    const body = await req.json().catch(() => ({}));
    const onlyBmId: string | undefined = body?.bm_id;

    // BMs alvo
    let q = admin.from("meta_business_managers").select("id, meta_bm_id, name, status");
    if (onlyBmId) q = q.eq("id", onlyBmId);
    const { data: bms } = await q;
    if (!bms?.length) return json({ sucesso: true, varridas: 0, usuarios: 0 });

    const fetchEdge = async (metaBmId: string, edge: string) => {
      const url = `${GRAPH}/${metaBmId}/${edge}?fields=id,name,email,role&limit=200&access_token=${token}`;
      try {
        const r = await fetch(url);
        const j = await r.json();
        if (!r.ok) return [];
        return j.data || [];
      } catch { return []; }
    };

    let totalUsers = 0;
    const detectedRows: any[] = [];
    for (const bm of bms) {
      const [bu, su] = await Promise.all([fetchEdge(bm.meta_bm_id, "business_users"), fetchEdge(bm.meta_bm_id, "system_users")]);
      const users = [
        ...bu.map((u: any) => ({ id: u.id, name: u.name, email: u.email || null, role: u.role || null, kind: "business" })),
        ...su.map((u: any) => ({ id: u.id, name: u.name, email: null, role: u.role || null, kind: "system" })),
      ];
      totalUsers += users.length;
      // limpa antigos
      await admin.from("bm_detected_users").delete().eq("bm_id", bm.id);
      for (const u of users) {
        if (!u.id) continue;
        detectedRows.push({
          bm_id: bm.id,
          meta_user_id: String(u.id),
          user_name: u.name || null,
          user_email: u.email,
          user_role: u.role,
          user_kind: u.kind,
        });
      }
    }
    if (detectedRows.length) {
      // upsert em lotes de 500
      for (let i = 0; i < detectedRows.length; i += 500) {
        await admin.from("bm_detected_users").upsert(detectedRows.slice(i, i + 500), { onConflict: "bm_id,meta_user_id" });
      }
    }

    // Auto-sync de backups: para cada whitelist com backup_id definido,
    // garante que toda BM onde o perfil aparece tenha a relação bm_backup_assignments.
    const { data: wl } = await admin.from("meta_user_whitelist").select("meta_user_id, backup_id").not("backup_id", "is", null);
    let backupLinks = 0;
    if (wl?.length) {
      const ids = wl.map(w => w.meta_user_id);
      const { data: hits } = await admin.from("bm_detected_users").select("bm_id, meta_user_id").in("meta_user_id", ids);
      const { data: existing } = await admin.from("bm_backup_assignments").select("bm_id, backup_id");
      const have = new Set((existing || []).map(e => `${e.bm_id}::${e.backup_id}`));
      const toInsert: any[] = [];
      for (const h of hits || []) {
        const w = wl.find(x => x.meta_user_id === h.meta_user_id);
        if (!w?.backup_id) continue;
        const key = `${h.bm_id}::${w.backup_id}`;
        if (!have.has(key)) {
          have.add(key);
          toInsert.push({ bm_id: h.bm_id, backup_id: w.backup_id });
        }
      }
      if (toInsert.length) {
        await admin.from("bm_backup_assignments").insert(toInsert);
        backupLinks = toInsert.length;
      }
    }

    return json({ sucesso: true, bms_varridas: bms.length, usuarios_detectados: totalUsers, backups_vinculados: backupLinks });
  } catch (e) {
    return json({ erro: (e as Error).message }, 500);
  }
});
