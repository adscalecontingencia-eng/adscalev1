import React, { useState } from "react";
import { z } from "zod";
import { X, ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const schema = z.object({
  name: z.string().trim().min(2, "Informe seu nome").max(120),
  email: z.string().trim().email("E-mail inválido").max(200),
  whatsapp: z.string().trim().min(6, "WhatsApp inválido").max(30),
});

interface Props {
  open: boolean;
  onClose: () => void;
  redirectTo: string;
}

const LeadFormModal: React.FC<Props> = ({ open, onClose, redirectTo }) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ name, email, whatsapp });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from("marketplace_leads" as any).insert({
        name: parsed.data.name,
        email: parsed.data.email,
        whatsapp: parsed.data.whatsapp,
        source: "aluguel-de-contas",
        user_agent: navigator.userAgent,
        referrer: document.referrer || null,
      });
      if (error) throw error;
      try {
        sessionStorage.setItem(
          "lead_aluguel",
          JSON.stringify({ ...parsed.data, at: Date.now() })
        );
      } catch {}
      toast.success("Tudo certo! Vamos te levar para o cadastro.");
      window.location.hash = `#${redirectTo}`;
    } catch (err: any) {
      console.error(err);
      toast.error("Não foi possível enviar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-border/60 bg-card/95 backdrop-blur-xl p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-3 right-3 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition"
        >
          <X size={18} />
        </button>

        <div className="mb-5">
          <h3 className="font-display text-xl font-bold tracking-tight">
            Garanta seus <span className="text-primary">US$ 240 em créditos</span>
          </h3>
          <p className="text-sm text-muted-foreground mt-1.5">
            Deixe seu contato e seguimos com seu cadastro de aluguel.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Nome completo</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-border/60 bg-background px-3 py-2.5 text-sm focus:outline-none focus:border-primary/60 transition"
              placeholder="Seu nome"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-border/60 bg-background px-3 py-2.5 text-sm focus:outline-none focus:border-primary/60 transition"
              placeholder="voce@email.com"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">WhatsApp (com DDD/país)</label>
            <input
              type="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-border/60 bg-background px-3 py-2.5 text-sm focus:outline-none focus:border-primary/60 transition"
              placeholder="+55 11 99999-9999"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold px-5 py-3 rounded-xl hover:brightness-110 transition disabled:opacity-60"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <>Continuar para cadastro <ArrowRight size={16} /></>}
          </button>
          <p className="text-[11px] text-muted-foreground text-center pt-1">
            Ao continuar você concorda com nossos Termos de Uso e Política de Privacidade.
          </p>
        </form>
      </div>
    </div>
  );
};

export default LeadFormModal;
