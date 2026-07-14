import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AdScaleLogo from "@/components/AdScaleLogo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Package, ShoppingCart, Clock } from "lucide-react";
import { toast } from "sonner";

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

const MyOrders: React.FC = () => {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const requestId = params.get("solicitar");
  const qty = Number(params.get("qty") || 1);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: client } = await supabase.from("clients").select("id").eq("auth_user_id", user!.id).maybeSingle();
    if (!client) {
      setOrders([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("orders")
      .select("*, order_items(*, products(name)), order_deliveries(*), payments(*)")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false });
    setOrders(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  // Auto-create pending order if ?solicitar=PRODUCT_ID
  useEffect(() => {
    (async () => {
      if (!requestId || !user || creating) return;
      setCreating(true);
      const { data: client } = await supabase.from("clients").select("id").eq("auth_user_id", user.id).maybeSingle();
      if (!client) { setCreating(false); return; }
      const { data: prod } = await supabase
        .from("products")
        .select("id,name,sale_price,discount_price")
        .eq("id", requestId)
        .maybeSingle();
      if (!prod) { toast.error("Produto não encontrado"); setCreating(false); return; }

      const unit = (prod as any).discount_price ?? (prod as any).sale_price;
      const total = unit * qty;
      const { data: order, error } = await supabase
        .from("orders")
        .insert({
          client_id: client.id,
          total,
          status: "aguardando_pagamento",
          delivery_mode: "manual",
          notes: "Pedido criado via marketplace (Pix em breve)",
        })
        .select("id")
        .single();
      if (error || !order) { toast.error(error?.message || "Erro ao criar pedido"); setCreating(false); return; }

      // cost_snapshot is intentionally omitted client-side (internal margin data);
      // admins can backfill from products.cost_price via secure helpers.
      await supabase.from("order_items").insert({
        order_id: order.id,
        product_id: prod.id,
        quantity: qty,
        unit_price: unit,
        product_name_snapshot: (prod as any).name,
      });

      toast.success("Pedido criado! O suporte entrará em contato para liberar o pagamento Pix.");
      // Clean URL & reload
      window.history.replaceState({}, "", window.location.pathname + window.location.hash.split("?")[0]);
      setCreating(false);
      load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId, user]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-background/70 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 lg:px-6 h-16 flex items-center gap-4">
          <Link to="/marketplace" className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm">
            <ArrowLeft size={14} /> Marketplace
          </Link>
          <div className="text-primary"><AdScaleLogo size={22} /></div>
          <div className="ml-auto">
            <Button variant="outline" size="sm" onClick={() => window.location.hash = "#/client-dashboard"}>
              Painel
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 lg:px-6 py-10">
        <h1 className="font-display text-2xl font-bold mb-2">Meus pedidos</h1>
        <p className="text-muted-foreground text-sm mb-8">
          Acompanhe seus pedidos e as credenciais entregues.
        </p>

        {loading ? (
          <p className="text-muted-foreground text-sm">Carregando…</p>
        ) : orders.length === 0 ? (
          <div className="bg-card/60 border border-border/60 rounded-2xl p-12 text-center">
            <ShoppingCart size={32} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm">Você ainda não fez nenhum pedido.</p>
            <Link to="/marketplace"><Button className="mt-4">Ir ao marketplace</Button></Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((o) => (
              <div key={o.id} className="bg-card/60 border border-border/60 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Pedido</p>
                    <p className="font-mono text-xs">{o.id.slice(0, 8)} · {new Date(o.created_at).toLocaleString("pt-BR")}</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline">{o.status}</Badge>
                    <span className="text-primary font-bold">{fmtBRL(o.total)}</span>
                  </div>
                </div>

                <div className="space-y-1 text-sm">
                  {(o.order_items || []).map((it: any) => (
                    <div key={it.id} className="flex items-center justify-between text-xs">
                      <span>{it.quantity}× {it.products?.name || it.product_name_snapshot}</span>
                      <span className="text-muted-foreground">{fmtBRL(it.unit_price * it.quantity)}</span>
                    </div>
                  ))}
                </div>

                {o.order_deliveries && o.order_deliveries.length > 0 ? (
                  <div className="mt-3 pt-3 border-t border-border/60 space-y-1">
                    <p className="text-[10px] uppercase tracking-[0.25em] text-emerald-400 flex items-center gap-1.5">
                      <Package size={11} /> Credenciais entregues
                    </p>
                    {o.order_deliveries.map((d: any) => (
                      <pre key={d.id} className="bg-secondary/40 border border-border rounded p-2 text-[11px] whitespace-pre-wrap font-mono">
                        {JSON.stringify(d.payload, null, 2)}
                      </pre>
                    ))}
                  </div>
                ) : o.status === "aguardando_pagamento" ? (
                  <p className="mt-3 pt-3 border-t border-border/60 text-xs text-amber-400 flex items-center gap-1.5">
                    <Clock size={11} /> Aguardando pagamento — o suporte entrará em contato no WhatsApp para enviar o Pix.
                  </p>
                ) : (
                  <p className="mt-3 pt-3 border-t border-border/60 text-xs text-muted-foreground">
                    Processando entrega…
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default MyOrders;
