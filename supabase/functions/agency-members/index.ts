import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const PERMS = ["resumo", "clientes", "contas", "tiers", "creditos", "suporte", "marca", "juridico"] as const;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const Perms = z.array(z.enum(PERMS)).max(PERMS.length);
const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().toLowerCase().email().max(255),
    password: z.string().min(8).max(72),
    permissions: Perms,
  }),
  z.object({
    action: z.literal("update"),
    member_id: z.string().uuid(),
    name: z.string().trim().min(1).max(120).optional(),
    permissions: Perms.optional(),
    active: z.boolean().optional(),
  }),
  z.object({ action: z.literal("reset_password"), member_id: z.string().uuid(), password: z.string().min(8).max(72) }),
  z.object({ action: z.literal("delete"), member_id: z.string().uuid() }),
]);

function passwordError(msg: string) {
  const m = msg.toLowerCase();
  if (m.includes("pwned") || m.includes("weak") || m.includes("leaked") || m.includes("compromised"))
    return "Senha muito comum ou vazada. Use uma senha mais forte (letras, números e símbolos).";
  if (m.includes("already") || m.includes("registered") || m.includes("exists"))
    return "Este e-mail já tem acesso ao sistema. Use outro e-mail.";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    if (!token) return json({ error: "Não autenticado" }, 401);
    const { data: { user: caller }, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !caller) return json({ error: "Sessão inválida" }, 401);

    // Only the agency owner manages collaborators
    const { data: agency } = await admin.from("clients").select("id, is_agency").eq("auth_user_id", caller.id).maybeSingle();
    if (!agency?.is_agency) return json({ error: "Apenas o dono da agência pode gerenciar usuários" }, 403);

    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "Dados inválidos", details: parsed.error.flatten().fieldErrors }, 400);
    const b = parsed.data;

    if (b.action === "create") {
      const { count } = await admin.from("agency_members").select("id", { count: "exact", head: true }).eq("agency_client_id", agency.id);
      if ((count ?? 0) >= 50) return json({ error: "Limite de 50 colaboradores atingido" }, 400);
      const { data: created, error } = await admin.auth.admin.createUser({
        email: b.email, password: b.password, email_confirm: true,
        user_metadata: { name: b.name, role: "client", agency_member_of: agency.id },
      });
      if (error || !created?.user) {
        console.error("agency-members create", error);
        return json({ error: passwordError(error?.message || "") || "Não foi possível criar o acesso" }, 400);
      }
      const uid = created.user.id;
      await admin.from("user_roles").insert({ user_id: uid, role: "client" });
      const { error: insErr } = await admin.from("agency_members").insert({
        agency_client_id: agency.id, auth_user_id: uid, name: b.name, email: b.email,
        permissions: b.permissions, created_by: caller.id,
      });
      if (insErr) {
        console.error("agency-members insert", insErr);
        await admin.auth.admin.deleteUser(uid);
        return json({ error: "Não foi possível salvar o colaborador" }, 400);
      }
      return json({ ok: true });
    }

    const { data: member } = await admin.from("agency_members").select("id, auth_user_id, agency_client_id").eq("id", b.member_id).maybeSingle();
    if (!member || member.agency_client_id !== agency.id) return json({ error: "Colaborador não encontrado" }, 404);

    if (b.action === "update") {
      const patch: Record<string, unknown> = {};
      if (b.name !== undefined) patch.name = b.name;
      if (b.permissions !== undefined) patch.permissions = b.permissions;
      if (b.active !== undefined) patch.active = b.active;
      const { error } = await admin.from("agency_members").update(patch).eq("id", member.id);
      if (error) { console.error(error); return json({ error: "Não foi possível salvar" }, 400); }
      return json({ ok: true });
    }

    if (b.action === "reset_password") {
      const { error } = await admin.auth.admin.updateUserById(member.auth_user_id, { password: b.password });
      if (error) { console.error(error); return json({ error: passwordError(error.message) || "Não foi possível trocar a senha" }, 400); }
      return json({ ok: true });
    }

    // delete
    await admin.from("agency_members").delete().eq("id", member.id);
    await admin.from("user_roles").delete().eq("user_id", member.auth_user_id);
    await admin.auth.admin.deleteUser(member.auth_user_id);
    return json({ ok: true });
  } catch (e) {
    console.error("agency-members", e);
    return json({ error: "Erro interno" }, 500);
  }
});
