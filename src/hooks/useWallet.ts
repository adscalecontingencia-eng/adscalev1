import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const CACHE_PREFIX = "wallet:balance:";

function readCache(userId: string | null): number | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + userId);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch { return null; }
}
function writeCache(userId: string, balance: number) {
  try { localStorage.setItem(CACHE_PREFIX + userId, String(balance)); } catch { /* ignore */ }
}

export function useWallet() {
  const { isAuthenticated } = useAuth();
  // Hydrate optimistically from cached session + cached balance — avoids the "saldo demora" flash.
  const initialUserId = (() => {
    try {
      // Find any wallet cache key — there's typically only one user logged in per browser.
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(CACHE_PREFIX)) return k.slice(CACHE_PREFIX.length);
      }
    } catch { /* ignore */ }
    return null;
  })();
  const initialBalance = readCache(initialUserId);

  const [balance, setBalance] = useState<number>(initialBalance ?? 0);
  const [loading, setLoading] = useState<boolean>(initialBalance == null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const userIdRef = useRef<string | null>(initialUserId);

  const refresh = useCallback(async () => {
    // Prefer the cached session — avoids the extra network round-trip getUser() does.
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user ?? null;
    if (!user) { setBalance(0); setLoading(false); return; }
    userIdRef.current = user.id;
    const { data } = await supabase.from("wallets").select("balance").eq("user_id", user.id).maybeSingle();
    const next = Number(data?.balance ?? 0);
    setBalance(next);
    writeCache(user.id, next);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setBalance(0);
      setLoading(false);
      // Clear cache on sign-out so next user doesn't see stale numbers
      try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          if (k && k.startsWith(CACHE_PREFIX)) localStorage.removeItem(k);
        }
      } catch { /* ignore */ }
      return;
    }
    refresh();
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (!user) return;
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      channelRef.current = supabase
        .channel(`wallet-${user.id}`)
        .on("postgres_changes",
          { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${user.id}` },
          (payload) => {
            const row = (payload.new ?? payload.old) as { balance?: number } | null;
            if (row?.balance != null) {
              const next = Number(row.balance);
              setBalance(next);
              writeCache(user.id, next);
            }
          })
        .subscribe();
    })();
    return () => {
      if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
    };
  }, [isAuthenticated, refresh]);

  return { balance, loading, refresh };
}
