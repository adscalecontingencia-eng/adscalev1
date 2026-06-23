import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FileText, Sparkles, Wallet as WalletIcon, ShoppingCart } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/hooks/useWallet";
import LoginRequiredModal from "./LoginRequiredModal";
import CheckoutModal from "./CheckoutModal";
import WalletDepositModal from "./WalletDepositModal";

interface MarketplaceProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
}

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

export default function MarketplacePixSection() {
  const { isAuthenticated } = useAuth();
  const { balance } = useWallet();
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loginOpen, setLoginOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [selected, setSelected] = useState<MarketplaceProduct | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("marketplace_products")
        .select("id, name, description, price")
        .eq("status", "active")
        .order("created_at", { ascending: false });
      setProducts((data ?? []) as MarketplaceProduct[]);
      setLoading(false);
    })();
  }, []);

  function handleBuy(p: MarketplaceProduct) {
    if (!isAuthenticated) {
      setSelected(p);
      setLoginOpen(true);
      return;
    }
    setSelected(p);
    setCheckoutOpen(true);
  }

  if (!loading && products.length === 0) return null;

  return (
    <section id="produtos-digitais" className="relative max-w-7xl mx-auto px-4 lg:px-6 py-10 sm:py-14">
      <div className="text-center mb-8 sm:mb-10">
        <p className="text-[10px] uppercase tracking-[0.4em] text-primary/80 mb-3 flex items-center justify-center gap-2">
          <Sparkles className="w-3 h-3" /> Produtos Digitais
        </p>
        <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold text-foreground">
          Compre na hora com <span className="text-primary">saldo</span> da carteira
        </h2>
        <p className="text-sm text-muted-foreground mt-2">
          Deposite via Pix, compre com 1 clique e baixe instantaneamente.
        </p>

        {isAuthenticated && (
          <div className="mt-4 inline-flex items-center gap-3 rounded-full border border-primary/30 bg-primary/5 px-4 py-2">
            <WalletIcon className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Saldo:</span>
            <span className="text-sm font-bold text-foreground">{fmtBRL(balance)}</span>
            <Button size="sm" variant="outline" className="h-7 text-xs ml-2" onClick={() => setWalletOpen(true)}>
              Carteira
            </Button>
          </div>
        )}
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
                <Button size="sm" onClick={() => handleBuy(p)}>
                  <ShoppingCart className="w-4 h-4 mr-1" /> Comprar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <LoginRequiredModal open={loginOpen} onOpenChange={setLoginOpen} redirectTo="/marketplace" />
      <CheckoutModal open={checkoutOpen} onOpenChange={setCheckoutOpen} product={selected} />
      <WalletDepositModal open={walletOpen} onOpenChange={setWalletOpen} />
    </section>
  );
}
