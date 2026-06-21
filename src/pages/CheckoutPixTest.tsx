import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Copy, Loader2 } from "lucide-react";

interface PixResult {
  mercado_pago_order_id: string | null;
  mercado_pago_payment_id: string | null;
  pix_qr_code: string | null;
  pix_qr_code_base64: string | null;
  pix_ticket_url: string | null;
  status: string | null;
  status_detail: string | null;
  external_reference?: string;
}

export default function CheckoutPixTest() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PixResult | null>(null);
  const [name, setName] = useState("APRO");
  const [email, setEmail] = useState("test_user_br@testuser.com");

  const handleGenerate = async () => {
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("create-pix-order", {
        body: {
          amount: 200.0,
          product_name: "Plano AD•SCALE - Teste Pix",
          plan_id: "test-pix",
          customer_name: name,
          customer_email: email,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setResult(data as PixResult);
      toast({ title: "Pix gerado", description: "Escaneie o QR Code ou copie o código." });
    } catch (err: any) {
      console.error(err);
      toast({ title: "Erro ao gerar Pix", description: err.message ?? String(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result?.pix_qr_code) return;
    await navigator.clipboard.writeText(result.pix_qr_code);
    toast({ title: "Código copiado" });
  };

  return (
    <div className="min-h-screen bg-background p-6 flex items-center justify-center">
      <Card className="w-full max-w-xl p-6 space-y-5">
        <div>
          <h1 className="text-2xl font-bold">Checkout Pix - Teste</h1>
          <p className="text-sm text-muted-foreground">Plano AD•SCALE - Teste Pix · R$ 200,00</p>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>

        <Button onClick={handleGenerate} disabled={loading} className="w-full">
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gerando...</> : "Gerar Pix de Teste"}
        </Button>

        {result && (
          <div className="space-y-4 pt-4 border-t">
            <div className="text-sm">
              <div><span className="text-muted-foreground">Order ID:</span> {result.mercado_pago_order_id ?? "-"}</div>
              <div><span className="text-muted-foreground">Payment ID:</span> {result.mercado_pago_payment_id ?? "-"}</div>
              <div><span className="text-muted-foreground">Status:</span> <strong>{result.status ?? "-"}</strong> {result.status_detail ? `(${result.status_detail})` : ""}</div>
            </div>

            {result.pix_qr_code_base64 && (
              <div className="flex justify-center">
                <img
                  src={`data:image/png;base64,${result.pix_qr_code_base64}`}
                  alt="QR Code Pix"
                  className="w-56 h-56 border rounded"
                />
              </div>
            )}

            {result.pix_qr_code && (
              <div className="space-y-2">
                <Label>Pix copia e cola</Label>
                <textarea
                  readOnly
                  value={result.pix_qr_code}
                  className="w-full h-24 text-xs p-2 rounded border bg-muted font-mono"
                />
                <Button variant="outline" onClick={handleCopy} className="w-full">
                  <Copy className="w-4 h-4 mr-2" /> Copiar código Pix
                </Button>
              </div>
            )}

            {result.pix_ticket_url && (
              <a
                href={result.pix_ticket_url}
                target="_blank"
                rel="noreferrer"
                className="block text-center text-sm text-primary underline"
              >
                Abrir comprovante / ticket
              </a>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
