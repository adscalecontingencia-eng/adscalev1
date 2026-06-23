import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useWallet() {
  const { isAuthenticated } = useAuth();
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const refresh = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBalance(0); setLoading(false); return; }
    const { data } = await supabase.from("wallets").select("balance").eq("user_id", user.id).maybeSingle();
    setBalance(Number(data?.balance ?? 0));
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) { setBalance(0); setLoading(false); return; }
    setLoading(true);
    refresh();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      channelRef.current = supabase
        .channel(`wallet-${user.id}`)
        .on("postgres_changes",
          { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${user.id}` },
          (payload) => {
            const row = (payload.new ?? payload.old) as { balance?: number } | null;
            if (row?.balance != null) setBalance(Number(row.balance));
          })
        .subscribe();
    })();
    return () => {
      if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
    };
  }, [isAuthenticated, refresh]);

  return { balance, loading, refresh };
}
