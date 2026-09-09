// Shared auth helpers for edge functions.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export function getBearer(req: Request): string | null {
  const h = req.headers.get("Authorization") ?? "";
  return h.startsWith("Bearer ") ? h.slice(7).trim() : null;
}

export function isServiceCall(req: Request): boolean {
  const token = getBearer(req);
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return !!token && !!key && token === key;
}

/** Resolves the authenticated user id from the request JWT, or null. */
export async function getUserId(req: Request): Promise<string | null> {
  const jwt = getBearer(req);
  if (!jwt) return null;
  const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data } = await anon.auth.getClaims(jwt);
  return (data?.claims?.sub as string | undefined) ?? null;
}

export async function hasStaffRole(userId: string): Promise<boolean> {
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
  return (roles ?? []).some((r: any) => r.role === "admin" || r.role === "support");
}

/**
 * Requires the caller to be either the service role (internal/cron) or a
 * logged-in admin/support user. Returns an error Response when not allowed.
 */
export async function requireStaff(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<{ error: Response } | { error: null; userId: string | null; service: boolean }> {
  const fail = (msg: string, status: number) =>
    new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (isServiceCall(req)) return { error: null, userId: null, service: true };

  const jwt = getBearer(req);
  if (!jwt) return { error: fail("Unauthenticated", 401) };

  const uid = await getUserId(req);
  if (!uid) return { error: fail("Unauthenticated", 401) };
  if (!(await hasStaffRole(uid))) return { error: fail("Forbidden", 403) };
  return { error: null, userId: uid, service: false };
}
