import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify the caller is authenticated and is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if caller is admin
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    if (action === "create_user") {
      const { email, password, name, role, permissions, client_data } = body;

      if (!email || !password || !name || !role) {
        return new Response(JSON.stringify({ error: "Missing fields" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create auth user (auto-confirmed)
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, role },
      });

      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userId = newUser.user.id;

      // Assign role
      await supabaseAdmin.from("user_roles").insert({ user_id: userId, role });

      // Create profile in the right table
      if (role === "support") {
        await supabaseAdmin.from("support_users").insert({
          auth_user_id: userId,
          name,
          email,
          password: "managed-by-auth",
          permissions: permissions || ["support"],
        });
      } else if (role === "client") {
        const cd = client_data || {};
        const clientType = cd.clientType === "venda" ? "venda" : "aluguel";
        const paymentType = clientType === "venda" ? "fixed" : "percentage";
        await supabaseAdmin.from("clients").insert({
          auth_user_id: userId,
          name,
          email,
          password: "managed-by-auth",
          number: cd.number || "",
          company_name: cd.companyName || "",
          observations: cd.observations || "",
          client_type: clientType,
          payment_type: paymentType,
          fixed_value: clientType === "venda" ? (cd.fixedValue || 0) : 0,
          percentage_value: clientType === "aluguel" ? (cd.percentageValue || 0) : 0,
          plan_credit: clientType === "aluguel" ? (cd.planCredit || 0) : 0,
          ad_accounts: cd.adAccounts || 0,
          used_accounts: cd.usedAccounts || 0,
          blocked_accounts: cd.blockedAccounts || 0,
          whatsapp_phone: cd.whatsappPhone || null,
          whatsapp_group_link: cd.whatsappGroupLink || null,
        });
      }

      return new Response(JSON.stringify({ success: true, user_id: userId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reset_password") {
      const { client_id, user_id, new_password } = body;
      if (!new_password || typeof new_password !== "string" || new_password.length < 6) {
        return new Response(JSON.stringify({ error: "Senha deve ter ao menos 6 caracteres" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let targetUserId: string | null = user_id || null;
      if (!targetUserId && client_id) {
        const { data: cli } = await supabaseAdmin
          .from("clients")
          .select("auth_user_id")
          .eq("id", client_id)
          .maybeSingle();
        targetUserId = cli?.auth_user_id || null;
      }

      if (!targetUserId) {
        return new Response(JSON.stringify({ error: "Usuário de autenticação não encontrado para este cliente" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
        password: new_password,
      });
      if (updErr) {
        return new Response(JSON.stringify({ error: updErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete_user") {
      const { user_id } = body;
      if (!user_id) {
        return new Response(JSON.stringify({ error: "Missing user_id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Delete from auth (cascades to user_roles)
      const { error: delError } = await supabaseAdmin.auth.admin.deleteUser(user_id);
      if (delError) {
        return new Response(JSON.stringify({ error: delError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete_client") {
      const { client_id } = body;
      if (!client_id) {
        return new Response(JSON.stringify({ error: "Missing client_id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch client to get auth_user_id
      const { data: clientRow, error: fetchErr } = await supabaseAdmin
        .from("clients")
        .select("id, auth_user_id")
        .eq("id", client_id)
        .maybeSingle();

      if (fetchErr || !clientRow) {
        return new Response(JSON.stringify({ error: "Cliente não encontrado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Remove related records (no FK cascades in DB)
      await supabaseAdmin.from("commissions").delete().eq("client_id", client_id);
      await supabaseAdmin.from("transactions").delete().eq("client_id", client_id);
      await supabaseAdmin.from("meta_ad_account_assignments").delete().eq("client_id", client_id);
      await supabaseAdmin.from("meta_page_assignments").delete().eq("client_id", client_id);
      await supabaseAdmin.from("support_requests").delete().eq("client_id", client_id);
      await supabaseAdmin.from("meta_blocked_accounts_log").delete().eq("client_id", client_id);
      await supabaseAdmin.from("meta_critical_events").delete().eq("client_id", client_id);
      await supabaseAdmin.from("whatsapp_dispatch_log").delete().eq("client_id", client_id);
      await supabaseAdmin.from("client_terms_acceptances").delete().eq("client_id", client_id);

      // Delete client row
      const { error: clientDelErr } = await supabaseAdmin.from("clients").delete().eq("id", client_id);
      if (clientDelErr) {
        return new Response(JSON.stringify({ error: clientDelErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Delete auth user (cascades user_roles)
      if (clientRow.auth_user_id) {
        await supabaseAdmin.auth.admin.deleteUser(clientRow.auth_user_id);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
