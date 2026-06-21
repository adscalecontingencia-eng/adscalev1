import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Download, Loader2, ArrowLeft, FileText } from "lucide-react";

interface OrderRow {
  id: string;
  status: string;
  download_released: boolean;
  amount: number;
  created_at: string;
  paid_at: string | null;
  customer_email: string | null;
  product_id: string;
  marketplace_products?: { name: string } | null;
}

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

export default function MyPixOrders() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [emailFilter, setEmailFilter] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;

    let query = supabase
      .from("marketplace_orders")
      .select("id, status, download_released, amount, created_at, paid_at, customer_email, product_id, marketplace_products(name)")
      .order("created_at", { ascending: false })
      .limit(50);

    if (userId) {
      query = query.eq("user_id", userId);
    } else if (emailFilter.trim()) {
      query = query.eq("customer_email", emailFilter.trim()).eq("status", "approved");
    } else {
      setOrders([]);
      setLoading(false);
      return;
    }

    const { data, error } = await query;
    if (error) {
      toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
    } else {
      setOrders((data ?? []) as unknown as OrderRow[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDownload(id: string) {
    setDownloadingId(id);
    try {
      const { data, error } = await supabase.functions.invoke("get-marketplace-download-link", {
        body: { marketplace_order_id: id },
      });
      if (error) throw error;
      const r = data as { url?: string; error?: string };
      if (r?.error || !r?.url) throw new Error(r?.error ?? "Arquivo não disponível");
      window.location.href = r.url;
    } catch (err: any) {
      toast({
        title: "Erro ao baixar",
        description: err?.message ?? String(err),
        variant: "destructive",
      });
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Link to="/marketplace" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar ao marketplace
        </Link>
        <h1 className="text-2xl font-bold mb-1">Minhas compras (Pix)</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Aqui você baixa novamente qualquer arquivo já pago.
        </p>

        <div className="mb-6 flex gap-2">
          <input
            type="email"
            placeholder="Buscar pelo e-mail usado na compra"
            value={emailFilter}
            onChange={(e) => setEmailFilter(e.target.value)}
            className="flex-1 rounded border bg-background px-3 py-2 text-sm"
          />
          <Button variant="outline" onClick={load}>Buscar</Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma compra encontrada.</p>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => {
              const canDownload = o.status === "approved" && o.download_released;
              return (
                <div
                  key={o.id}
                  className="rounded-lg border border-border p-4 flex items-center gap-3"
                >
                  <FileText className="w-5 h-5 text-primary" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {o.marketplace_products?.name ?? "Produto"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {fmtBRL(Number(o.amount))} ·{" "}
                      <span className={canDownload ? "text-primary" : ""}>{o.status}</span>
                      {o.paid_at ? ` · pago em ${new Date(o.paid_at).toLocaleString("pt-BR")}` : ""}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    disabled={!canDownload || downloadingId === o.id}
                    onClick={() => handleDownload(o.id)}
                  >
                    {downloadingId === o.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <><Download className="w-4 h-4 mr-1" /> Baixar</>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
