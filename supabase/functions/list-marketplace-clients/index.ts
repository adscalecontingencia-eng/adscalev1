import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    // Verify caller is admin/support
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: userRes } = await userClient.auth.getUser();
    const uid = userRes?.user?.id;
    if (!uid) return json({ error: "unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", uid);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "support");
    if (!isAdmin) return json({ error: "forbidden" }, 403);

    // Find all marketplace_client users
    const { data: mcRoles } = await admin.from("user_roles").select("user_id").eq("role", "marketplace_client");
    const userIds = Array.from(new Set((mcRoles ?? []).map((r: any) => r.user_id)));

    // Page through auth.users (we only need details for these userIds)
    const usersMap = new Map<string, { email: string; name: string; phone: string; created_at: string }>();
    let page = 1;
    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) break;
      const users = data?.users ?? [];
      users.forEach((u) => {
        if (userIds.includes(u.id)) {
          usersMap.set(u.id, {
            email: u.email || "",
            name: (u.user_metadata as any)?.name || "",
            phone: (u.user_metadata as any)?.phone || "",
            created_at: u.created_at || "",
          });
        }
      });
      if (users.length < 1000) break;
      page++;
      if (page > 20) break;
    }

    // Aggregate wallets + deposits + purchases
    const [{ data: wallets }, { data: deposits }, { data: txs }] = await Promise.all([
      admin.from("wallets").select("user_id,balance").in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]),
      admin.from("wallet_deposits").select("user_id,amount,status").in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]),
      admin.from("wallet_transactions").select("user_id,type,amount").in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]),
    ]);

    const balMap = new Map<string, number>();
    (wallets ?? []).forEach((w: any) => balMap.set(w.user_id, Number(w.balance || 0)));
    const depMap = new Map<string, number>();
    (deposits ?? []).forEach((d: any) => {
      if (d.status === "approved") depMap.set(d.user_id, (depMap.get(d.user_id) || 0) + Number(d.amount || 0));
    });
    const spentMap = new Map<string, number>();
    (txs ?? []).forEach((t: any) => {
      if (t.type === "purchase") spentMap.set(t.user_id, (spentMap.get(t.user_id) || 0) + Math.abs(Number(t.amount || 0)));
    });

    const rows = userIds.map((uid) => {
      const u = usersMap.get(uid);
      return {
        user_id: uid,
        email: u?.email || "",
        name: u?.name || "",
        phone: u?.phone || "",
        created_at: u?.created_at || "",
        balance: balMap.get(uid) || 0,
        total_deposited: depMap.get(uid) || 0,
        total_spent: spentMap.get(uid) || 0,
      };
    }).sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));

    return json({ rows });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
