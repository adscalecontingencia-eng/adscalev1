import React, { useMemo, useState } from "react";
import { z } from "zod";
import { X, ArrowRight, Loader2, CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addDays, startOfDay, isBefore, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const schema = z.object({
  name: z.string().trim().min(2, "Informe seu nome").max(120),
  email: z.string().trim().email("E-mail inválido").max(200),
  whatsapp: z.string().trim().min(6, "WhatsApp inválido").max(30),
  niche: z.string().trim().min(2, "Informe seu nicho").max(120),
  weekly_investment_usd: z.number().positive("Informe um valor válido"),
  scheduled_call_at: z.string().min(1, "Selecione data e horário"),
});

const TIME_SLOTS = [
  "09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00",
];

interface Props {
  open: boolean;
  onClose: () => void;
  redirectTo?: string;
}

const LeadFormModal: React.FC<Props> = ({ open, onClose, redirectTo = "/obrigado" }) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [niche, setNiche] = useState("");
  const [investment, setInvestment] = useState("");
  const [date, setDate] = useState<Date | undefined>();
  const [time, setTime] = useState("");
  const [loading, setLoading] = useState(false);

  const minDate = useMemo(() => addDays(startOfDay(new Date()), 1), []);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!date || !time) {
      toast.error("Selecione data e horário para a call");
      return;
    }
    const [hh, mm] = time.split(":").map(Number);
    const scheduled = new Date(date);
    scheduled.setHours(hh, mm, 0, 0);

    const parsed = schema.safeParse({
      name, email, whatsapp, niche,
      weekly_investment_usd: Number(String(investment).replace(",", ".")),
      scheduled_call_at: scheduled.toISOString(),
    });
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
        niche: parsed.data.niche,
        weekly_investment_usd: parsed.data.weekly_investment_usd,
        scheduled_call_at: parsed.data.scheduled_call_at,
        source: "aluguel-de-contas",
        user_agent: navigator.userAgent,
        referrer: document.referrer || null,
      });
      if (error) throw error;

      try {
        sessionStorage.setItem("lead_aluguel", JSON.stringify({
          name: parsed.data.name,
          email: parsed.data.email,
          scheduled_call_at: parsed.data.scheduled_call_at,
          at: Date.now(),
        }));
      } catch {}

      window.location.hash = `#${redirectTo}`;
    } catch (err: any) {
      console.error(err);
      toast.error("Não foi possível enviar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-lg my-8 rounded-2xl border border-border/60 bg-card/95 backdrop-blur-xl p-6 shadow-2xl">
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
            Agende sua <span className="text-primary">call de apresentação</span>
          </h3>
          <p className="text-sm text-muted-foreground mt-1.5">
            Preencha os dados abaixo e escolha um horário. Nosso time entra em contato para apresentar o modelo de aluguel.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Nome completo">
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} placeholder="Seu nome" />
            </Field>
            <Field label="WhatsApp (com DDD/país)">
              <input type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} required className={inputCls} placeholder="+55 11 99999-9999" />
            </Field>
          </div>

          <Field label="E-mail">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputCls} placeholder="voce@email.com" />
          </Field>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Nicho de atuação">
              <input type="text" value={niche} onChange={(e) => setNiche(e.target.value)} required className={inputCls} placeholder="Ex: e-commerce, info, lead gen" />
            </Field>
            <Field label="Investimento semanal (USD)">
              <input
                type="number" inputMode="decimal" min={0} step="any"
                value={investment} onChange={(e) => setInvestment(e.target.value)}
                required className={inputCls} placeholder="Ex: 5000"
              />
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Data da call">
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(inputCls, "flex items-center justify-between text-left", !date && "text-muted-foreground")}
                  >
                    {date ? format(date, "dd 'de' MMMM", { locale: ptBR }) : "Selecione a data"}
                    <CalendarIcon size={15} className="text-muted-foreground" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[110]" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    locale={ptBR}
                    disabled={(d) => isBefore(d, minDate) && !isSameDay(d, minDate)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </Field>
            <Field label="Horário (BRT)">
              <select
                value={time} onChange={(e) => setTime(e.target.value)} required
                className={cn(inputCls, "appearance-none")}
              >
                <option value="">Selecione</option>
                {TIME_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold px-5 py-3 rounded-xl hover:brightness-110 transition disabled:opacity-60 mt-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <>Agendar minha call <ArrowRight size={16} /></>}
          </button>
          <p className="text-[11px] text-muted-foreground text-center pt-1">
            Ao enviar você concorda com nossos Termos de Uso e Política de Privacidade.
          </p>
        </form>
      </div>
    </div>
  );
};

const inputCls = "w-full rounded-lg border border-border/60 bg-background px-3 py-2.5 text-sm focus:outline-none focus:border-primary/60 transition";

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="text-xs font-medium text-muted-foreground">{label}</label>
    <div className="mt-1">{children}</div>
  </div>
);

export default LeadFormModal;
