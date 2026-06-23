import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShoppingCart, Plus, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/hooks/useWallet";
import WalletDepositModal from "./WalletDepositModal";

const fmt = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

interface Product { id: string; name: string; description: string | null; price: number; }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  product: Product | null;
}

export default function CheckoutModal({ open, onOpenChange, product }: Props) {
  const { toast } = useToast();
  const { balance, refresh } = useWallet();
  const [quantity] = useState(1);
  const [coupon, setCoupon] = useState("");
  const [buying, setBuying] = useState(false);
  const [purchased, setPurchased] = useState<{ order_id: string } | null>(null);
  const [walletOpen, setWalletOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  if (!product) return null;
  const total = Number(product.price) * quantity;
  const insufficient = balance < total;

  async function buy() {
    if (!product) return;
    setBuying(true);
    try {
      const { data, error } = await supabase.functions.invoke("wallet-purchase-product", { body: { product_id: product.id, quantity } });
      if (error) throw error;
      const r = data as any;
      if (r?.error) throw new Error(r.error);
      setPurchased({ order_id: r.order_id });
      refresh();
      toast({ title: "Compra concluída!", description: "Produto liberado para download." });
    } catch (e: any) {
      toast({ title: "Erro na compra", description: e?.message ?? String(e), variant: "destructive" });
    } finally { setBuying(false); }
  }

  async function download() {
    if (!purchased) return;
    setDownloading(true);
    try {
      const { data, error } = await supabase.functions.invoke("get-marketplace-download-link", { body: { marketplace_order_id: purchased.order_id } });
      if (error) throw error;
      const r = data as { url?: string; error?: string };
      if (r?.error || !r?.url) throw new Error(r?.error ?? "Indisponível");
      window.location.href = r.url;
    } catch (e: any) {
      toast({ title: "Erro ao baixar", description: e?.message ?? String(e), variant: "destructive" });
    } finally { setDownloading(false); }
  }

  function close(v: boolean) {
    if (!v) setPurchased(null);
    onOpenChange(v);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-primary/15 text-primary grid place-items-center">
                <ShoppingCart className="w-5 h-5" />
              </div>
              Finalizar Compra
            </DialogTitle>
          </DialogHeader>

          {purchased ? (
            <div className="text-center py-6 space-y-3">
              <CheckCircle2 className="w-14 h-14 mx-auto text-primary" />
              <h3 className="text-lg font-bold text-foreground">Pedido aprovado!</h3>
              <p className="text-xs text-muted-foreground">Seu produto está liberado.</p>
              <Button onClick={download} disabled={downloading} className="w-full">
                {downloading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Baixar agora
              </Button>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-border p-4 flex items-start justify-between">
                <div>
                  <div className="font-semibold text-foreground">{product.name}</div>
                  {product.description && <div className="text-xs text-muted-foreground line-clamp-1">{product.description}</div>}
                  <div className="text-xs text-muted-foreground mt-1">{fmt(Number(product.price))} × {quantity}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-foreground">{fmt(total)}</div>
                  <div className="text-[11px] text-muted-foreground">{quantity} unidade</div>
                </div>
              </div>

              <div>
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Cupom de desconto</Label>
                <div className="flex gap-2 mt-1">
                  <Input placeholder="Código do cupom" value={coupon} onChange={(e) => setCoupon(e.target.value)} />
                  <Button variant="outline" disabled>Aplicar</Button>
                </div>
              </div>

              <div className="rounded-xl border border-border p-4 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="text-foreground">{fmt(total)}</span></div>
                <div className="flex justify-between text-base font-semibold"><span>Total</span><span className="text-primary">{fmt(total)}</span></div>
              </div>

              {insufficient ? (
                <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                  <div className="text-xs">
                    <div className="font-semibold text-destructive">Saldo insuficiente</div>
                    <div className="text-muted-foreground">Saldo atual: {fmt(balance)}. Adicione saldo para continuar.</div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground">
                  Saldo disponível: <strong className="text-foreground">{fmt(balance)}</strong> — será debitado <strong className="text-foreground">{fmt(total)}</strong>.
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancelar</Button>
                {insufficient ? (
                  <Button className="flex-1" onClick={() => setWalletOpen(true)}>
                    <Plus className="w-4 h-4 mr-1" /> Adicionar Saldo
                  </Button>
                ) : (
                  <Button className="flex-1" onClick={buy} disabled={buying}>
                    {buying && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Confirmar compra
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <WalletDepositModal
        open={walletOpen}
        onOpenChange={setWalletOpen}
        initialAmount={Math.max(0, total - balance)}
      />
    </>
  );
}
