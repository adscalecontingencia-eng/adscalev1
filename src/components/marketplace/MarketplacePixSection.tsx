import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Copy, Loader2, FileText, Download, CheckCircle2, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

interface MarketplaceProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
}

interface PixResult {
  order_id: string;
  external_reference: string;
  pix_qr_code: string | null;
  pix_qr_code_base64: string | null;
  pix_ticket_url: string | null;
  status: string;
}

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

export default function MarketplacePixSection() {
  const { toast } = useToast();
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);

  // Buy modal state
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<MarketplaceProduct | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [doc, setDoc] = useState("");
  const [generating, setGenerating] = useState(false);
  const [pix, setPix] = useState<PixResult | null>(null);
  const [orderStatus, setOrderStatus] = useState<string>("pending");

  // Success modal
  const [successOpen, setSuccessOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const pollRef = useRef<number | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("marketplace_products")
        .select("id, name, description, price")
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (!error) setProducts((data ?? []) as MarketplaceProduct[]);
      setLoading(false);
    })();
  }, []);

  // Cleanup polling/realtime
  useEffect(() => () => stopWatching(), []);

  function stopWatching() {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }

  function startWatching(orderId: string) {
    stopWatching();
    // Realtime
    channelRef.current = supabase
      .channel(`mkt-order-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "marketplace_orders", filter: `id=eq.${orderId}` },
        (payload) => {
          const row = payload.new as { status: string; download_released: boolean };
          setOrderStatus(row.status);
          if (row.status === "approved" && row.download_released) {
            handleApproved();
          }
        },
      )
      .subscribe();

    // Polling fallback every 5s
    pollRef.current = window.setInterval(async () => {
      try {
        const { data } = await supabase.functions.invoke("check-marketplace-order-status", {
          body: { order_id: orderId },
        });
        const r = data as { status?: string; download_released?: boolean };
        if (r?.status) setOrderStatus(r.status);
        if (r?.status === "approved" && r?.download_released) handleApproved();
        if (r?.status === "rejected" || r?.status === "cancelled" || r?.status === "expired") {
          toast({
            title: "Pagamento não aprovado",
            description: "O Pix foi recusado ou expirou. Gere uma nova cobrança.",
            variant: "destructive",
          });
          stopWatching();
        }
      } catch (e) {
        console.warn("poll error", e);
      }
    }, 5000);
  }

  function handleApproved() {
    stopWatching();
    setOpen(false);
    setSuccessOpen(true);
  }

  function openBuy(p: MarketplaceProduct) {
    setSelected(p);
    setPix(null);
    setOrderStatus("pending");
    setName("");
    setEmail("");
    setDoc("");
    setOpen(true);
  }

  async function handleGeneratePix() {
    if (!selected) return;
    if (!name.trim() || !email.trim()) {
      toast({ title: "Preencha nome e e-mail", variant: "destructive" });
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-marketplace-pix-order", {
        body: {
          product_id: selected.id,
          customer_name: name.trim(),
          customer_email: email.trim(),
          customer_document: doc.trim() || undefined,
        },
      });
      if (error) throw error;
      const r = data as PixResult & { error?: string };
      if (r?.error) throw new Error(r.error);
      setPix(r);
      setOrderStatus(r.status ?? "pending");
      startWatching(r.order_id);
      toast({ title: "Pix gerado", description: "Escaneie o QR Code ou use o copia-e-cola." });
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Erro ao gerar Pix",
        description: err?.message ?? String(err),
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy() {
    if (!pix?.pix_qr_code) return;
    await navigator.clipboard.writeText(pix.pix_qr_code);
    toast({ title: "Código Pix copiado" });
  }

  async function handleDownload() {
    if (!pix?.order_id) return;
    setDownloading(true);
    try {
      const { data, error } = await supabase.functions.invoke("get-marketplace-download-link", {
        body: { marketplace_order_id: pix.order_id },
      });
      if (error) throw error;
      const r = data as { url?: string; error?: string };
      if (r?.error || !r?.url) throw new Error(r?.error ?? "Arquivo não disponível");
      window.location.href = r.url;
    } catch (err: any) {
      toast({
        title: "Erro ao baixar arquivo",
        description: err?.message ?? String(err),
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  }

  if (!loading && products.length === 0) return null;

  return (
    <section id="produtos-digitais" className="relative max-w-7xl mx-auto px-4 lg:px-6 py-10 sm:py-14">
      <div className="text-center mb-8 sm:mb-10">
        <p className="text-[10px] uppercase tracking-[0.4em] text-primary/80 mb-3 flex items-center justify-center gap-2">
          <Sparkles className="w-3 h-3" /> Produtos Digitais
        </p>
        <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold text-foreground">
          Compre por <span className="text-primary">Pix</span> e baixe na hora
        </h2>
        <p className="text-sm text-muted-foreground mt-2">
          Pagou, liberou. Arquivo entregue em segundos após confirmação do pagamento.
        </p>
        <div className="mt-3 text-xs">
          <Link to="/minhas-compras-pix" className="text-primary underline">
            Já comprou? Veja minhas compras
          </Link>
        </div>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground text-sm py-12">Carregando…</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {products.map((p) => (
            <div
              key={p.id}
              className="group relative rounded-2xl border border-border bg-card/60 backdrop-blur p-5 flex flex-col gap-3 hover:border-primary/60 transition"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/15 text-primary grid place-items-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground line-clamp-2">{p.name}</h3>
                  {p.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</p>
                  )}
                </div>
              </div>
              <div className="mt-auto flex items-center justify-between pt-2">
                <div className="text-lg font-bold text-foreground">{fmtBRL(Number(p.price))}</div>
                <Button size="sm" onClick={() => openBuy(p)}>
                  Comprar com Pix
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Buy / Pix modal */}
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) stopWatching();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selected?.name ?? "Comprar"}</DialogTitle>
            <DialogDescription>
              {selected ? fmtBRL(Number(selected.price)) : ""} · Pagamento via Pix
            </DialogDescription>
          </DialogHeader>

          {!pix ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="mkt-name">Nome completo</Label>
                <Input id="mkt-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mkt-email">E-mail</Label>
                <Input id="mkt-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mkt-doc">CPF/CNPJ (opcional)</Label>
                <Input id="mkt-doc" value={doc} onChange={(e) => setDoc(e.target.value)} />
              </div>
              <Button onClick={handleGeneratePix} disabled={generating} className="w-full">
                {generating ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gerando Pix…</>
                ) : (
                  "Gerar Pix"
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {pix.pix_qr_code_base64 && (
                <div className="flex justify-center">
                  <img
                    src={`data:image/png;base64,${pix.pix_qr_code_base64}`}
                    alt="QR Code Pix"
                    className="w-52 h-52 border rounded bg-white"
                  />
                </div>
              )}
              {pix.pix_qr_code && (
                <div className="space-y-2">
                  <Label>Pix copia e cola</Label>
                  <textarea
                    readOnly
                    value={pix.pix_qr_code}
                    className="w-full h-20 text-xs p-2 rounded border bg-muted font-mono"
                  />
                  <Button variant="outline" onClick={handleCopy} className="w-full">
                    <Copy className="w-4 h-4 mr-2" /> Copiar código Pix
                  </Button>
                </div>
              )}
              <div className="text-sm text-center py-2 rounded bg-muted/50 flex items-center justify-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                Status: <strong>{orderStatus === "pending" ? "Aguardando pagamento" : orderStatus}</strong>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Success modal */}
      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="text-primary w-5 h-5" /> Pagamento aprovado!
            </DialogTitle>
            <DialogDescription>Seu arquivo está pronto para download.</DialogDescription>
          </DialogHeader>
          <Button onClick={handleDownload} disabled={downloading} className="w-full">
            {downloading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gerando link…</>
            ) : (
              <><Download className="w-4 h-4 mr-2" /> Baixar arquivo TXT</>
            )}
          </Button>
          <DialogFooter>
            <Link to="/minhas-compras-pix" className="text-xs text-muted-foreground underline">
              Ver minhas compras
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
