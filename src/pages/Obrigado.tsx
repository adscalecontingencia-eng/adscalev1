import React, { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, MessageCircle, Calendar, ArrowRight } from "lucide-react";
import AdScaleLogo from "@/components/AdScaleLogo";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const Obrigado: React.FC = () => {
  useEffect(() => {
    document.title = "Obrigado! — AD SCALE";
  }, []);

  const lead = useMemo(() => {
    try {
      const raw = sessionStorage.getItem("lead_aluguel");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }, []);

  const scheduled = lead?.scheduled_call_at ? new Date(lead.scheduled_call_at) : null;

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden flex flex-col">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full bg-primary/10 blur-3xl" />
      </div>

      <header className="relative z-10 border-b border-border/60 backdrop-blur-xl bg-background/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center">
          <div className="text-primary notranslate" translate="no">
            <AdScaleLogo size={26} />
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-xl w-full text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/15 border border-primary/40 grid place-items-center mb-6">
            <CheckCircle2 size={32} className="text-primary" />
          </div>

          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">
            Recebemos seu pedido{lead?.name ? `, ${String(lead.name).split(" ")[0]}` : ""}!
          </h1>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            Obrigado por se interessar pela <span className="notranslate" translate="no">AD SCALE</span>.
            Nosso time vai entrar em contato pelo WhatsApp para confirmar sua call de apresentação e tirar todas as suas dúvidas.
          </p>

          {scheduled && (
            <div className="mt-8 rounded-2xl border border-primary/30 bg-primary/5 p-5 text-left">
              <div className="flex items-center gap-2 text-primary text-xs uppercase tracking-[0.3em]">
                <Calendar size={14} /> Call agendada
              </div>
              <p className="mt-2 font-display text-lg font-semibold">
                {format(scheduled, "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Você receberá a confirmação e o link da reunião pelo WhatsApp.
              </p>
            </div>
          )}

          <div className="mt-8 grid sm:grid-cols-3 gap-3 text-left">
            <Step n="1" t="Confirmação" d="Validamos os dados em poucos minutos." />
            <Step n="2" t="Contato" d="Falamos com você pelo WhatsApp informado." />
            <Step n="3" t="Apresentação" d="Mostramos o modelo e ativamos seu acesso." />
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <a
              href="https://wa.me/"
              className="inline-flex items-center gap-2 border border-border/60 hover:border-primary/40 text-sm font-medium px-5 py-3 rounded-xl transition"
            >
              <MessageCircle size={15} /> Falar no WhatsApp
            </a>
            <Link
              to="/aluguel-de-contas"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-5 py-3 rounded-xl hover:brightness-110 transition"
            >
              Voltar para a página <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-border/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-xs text-muted-foreground text-center">
          © {new Date().getFullYear()} <span className="notranslate" translate="no">AD SCALE</span>
        </div>
      </footer>
    </div>
  );
};

const Step: React.FC<{ n: string; t: string; d: string }> = ({ n, t, d }) => (
  <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-xl p-4">
    <div className="text-primary text-xs font-bold">PASSO {n}</div>
    <div className="font-display font-semibold mt-1">{t}</div>
    <div className="text-xs text-muted-foreground mt-1">{d}</div>
  </div>
);

export default Obrigado;
