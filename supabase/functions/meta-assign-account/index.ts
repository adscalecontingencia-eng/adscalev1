// Atribui (ou desatribui) uma conta de anúncio Meta a um cliente
// POST { action: "assign"|"unassign", ad_account_id: uuid, client_id: uuid }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ erro: "Use POST" }, 405);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Auth: only admin/support
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ erro: "Não autenticado" }, 401);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ erro: "Não autenticado" }, 401);

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const isAdminOrSupport = (roles || []).some((r: any) => r.role === "admin" || r.role === "support");
    if (!isAdminOrSupport) return json({ erro: "Acesso negado" }, 403);

    const { action, ad_account_id, client_id } = await req.json();
    if (!action || !ad_account_id) {
      return json({ erro: "Campos obrigatórios: action, ad_account_id" }, 400);
    }
    if (action === "assign" && !client_id) {
      return json({ erro: "client_id é obrigatório para assign" }, 400);
    }

    if (action === "assign") {
      // Deactivate any existing active assignment for this account (1 client at a time)
      await supabase
        .from("meta_ad_account_assignments")
        .update({ active: false })
        .eq("ad_account_id", ad_account_id)
        .eq("active", true);

      const { data, error } = await supabase
        .from("meta_ad_account_assignments")
        .upsert(
          { ad_account_id, client_id, active: true, assigned_at: new Date().toISOString() },
          { onConflict: "ad_account_id,client_id" }
        )
        .select()
        .single();
      if (error) return json({ erro: error.message }, 400);
      return json({ sucesso: true, atribuicao: data });
    }

    if (action === "unassign") {
      const q = supabase
        .from("meta_ad_account_assignments")
        .update({ active: false })
        .eq("ad_account_id", ad_account_id);
      if (client_id) q.eq("client_id", client_id);
      const { error } = await q;
      if (error) return json({ erro: error.message }, 400);
      return json({ sucesso: true });
    }

    return json({ erro: "action inválida" }, 400);
  } catch (e) {
    return json({ erro: (e as Error).message }, 500);
  }
});
