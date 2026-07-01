import React, { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  BookOpen, CheckSquare, ExternalLink, Copy, ShieldCheck, Users, KeyRound,
  AlertTriangle, ArrowRight, ClipboardCheck,
} from "lucide-react";
import { toast } from "sonner";

type Props = { trigger?: React.ReactNode };

const REQUIRED = [
  { name: "ads_read", why: "Ler contas de anúncio, campanhas e insights." },
  { name: "ads_management", why: "Criar/pausar campanhas e gerenciar ativos de anúncio." },
  { name: "business_management", why: "Enxergar Business Managers e ativos vinculados." },
];
const OPTIONAL = [
  { name: "pages_show_list", why: "Listar páginas vinculadas ao negócio." },
  { name: "pages_read_engagement", why: "Métricas de páginas (se usadas)." },
  { name: "read_insights", why: "Ler insights orgânicos de páginas/perfis." },
];

const copy = (text: string) => {
  navigator.clipboard.writeText(text).then(
    () => toast.success("Copiado"),
    () => toast.error("Falha ao copiar")
  );
};

export const SystemUserTokenGuide: React.FC<Props> = ({ trigger }) => {
  const [step, setStep] = useState(1);
  const total = 5;

  return (
    <Dialog onOpenChange={(o) => { if (o) setStep(1); }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-1.5">
            <BookOpen size={14} /> Como gerar o token
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound size={18} className="text-primary" />
            Guia: gerar System User Token no Business Manager
          </DialogTitle>
          <div className="flex items-center gap-1 pt-2">
            {Array.from({ length: total }).map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded ${i + 1 <= step ? "bg-primary" : "bg-muted"}`}
              />
            ))}
            <span className="text-[10px] text-muted-foreground ml-2">
              Passo {step}/{total}
            </span>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm">
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-muted-foreground">
                Antes de qualquer coisa: <b>garanta que o System User existe</b> e que ele tem acesso
                às contas de anúncio que você quer sincronizar.
              </p>
              <Card className="p-3 space-y-2">
                <div className="flex items-center gap-2 font-medium">
                  <Users size={14} className="text-primary" /> 1a. Criar / abrir System User
                </div>
                <ol className="list-decimal ml-5 space-y-1 text-muted-foreground">
                  <li>Abra o Business Manager da sua agência.</li>
                  <li>Vá em <b>Configurações do Negócio</b> → <b>Usuários</b> → <b>Usuários do Sistema</b>.</li>
                  <li>Crie um usuário do tipo <b>Admin</b> (ou abra o existente que você usa para APIs).</li>
                </ol>
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 text-xs"
                  onClick={() => window.open("https://business.facebook.com/settings/system-users", "_blank")}
                >
                  Abrir Users no BM <ExternalLink size={12} />
                </Button>
              </Card>
              <Card className="p-3 space-y-2">
                <div className="flex items-center gap-2 font-medium">
                  <ShieldCheck size={14} className="text-primary" /> 1b. Atribuir o app ao System User
                </div>
                <ol className="list-decimal ml-5 space-y-1 text-muted-foreground">
                  <li>Na tela do System User, clique em <b>Adicionar Ativos</b> → <b>Apps</b>.</li>
                  <li>Selecione seu app AdScale e marque <b>Desenvolver App</b>.</li>
                </ol>
              </Card>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <p className="text-muted-foreground">
                Este é o passo <b>mais esquecido</b> — se pular, o token vai ser válido mas
                <b> nenhuma conta de anúncio aparece</b>.
              </p>
              <Card className="p-3 space-y-2">
                <div className="flex items-center gap-2 font-medium">
                  <Users size={14} className="text-primary" /> 2. Atribuir contas de anúncio ao System User
                </div>
                <ol className="list-decimal ml-5 space-y-1 text-muted-foreground">
                  <li>Ainda na tela do System User → clique em <b>Adicionar Ativos</b>.</li>
                  <li>Escolha <b>Contas de anúncios</b>.</li>
                  <li>Marque <b>todas</b> as contas que quer sincronizar.</li>
                  <li>
                    Nível de acesso: marque <b>Gerenciar campanhas</b>{" "}
                    <Badge variant="outline" className="ml-1">recomendado</Badge>{" "}
                    ou pelo menos <b>Visualizar performance</b>.
                  </li>
                  <li>Clique em <b>Salvar alterações</b>.</li>
                </ol>
              </Card>
              <div className="flex gap-2 text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 rounded p-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>
                  Se você não fizer este passo, <code className="bg-black/20 px-1 rounded">/me/adaccounts</code>{" "}
                  volta sempre vazio — mesmo com todos os checkboxes de permissão marcados no próximo passo.
                </span>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <p className="text-muted-foreground">
                Agora sim: <b>gere o token</b>. Ainda na tela do System User → botão{" "}
                <b>Gerar novo token</b>.
              </p>
              <Card className="p-3 space-y-2">
                <div className="flex items-center gap-2 font-medium">
                  <KeyRound size={14} className="text-primary" /> 3. Configuração do token
                </div>
                <ul className="list-disc ml-5 space-y-1 text-muted-foreground">
                  <li><b>App</b>: selecione o app AdScale.</li>
                  <li><b>Expiração do token</b>: <b>Nunca</b> (System User Token não expira).</li>
                  <li>Depois marque as <b>permissões obrigatórias</b> abaixo.</li>
                </ul>
              </Card>

              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Permissões obrigatórias (marque TODAS)
                </div>
                {REQUIRED.map((s) => (
                  <div key={s.name} className="flex items-start gap-2 border border-primary/40 bg-primary/5 rounded p-2">
                    <CheckSquare size={16} className="text-primary mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono bg-black/20 px-1.5 py-0.5 rounded">{s.name}</code>
                        <Button size="sm" variant="ghost" className="h-6 px-1.5" onClick={() => copy(s.name)}>
                          <Copy size={11} />
                        </Button>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{s.why}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Opcionais (marque se usar páginas)
                </div>
                {OPTIONAL.map((s) => (
                  <div key={s.name} className="flex items-start gap-2 border rounded p-2">
                    <CheckSquare size={16} className="text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <code className="text-xs font-mono bg-black/20 px-1.5 py-0.5 rounded">{s.name}</code>
                      <div className="text-xs text-muted-foreground mt-0.5">{s.why}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <p className="text-muted-foreground">
                Ao clicar em <b>Gerar Token</b>, a Meta mostra o token <b>uma única vez</b>. Copie
                imediatamente.
              </p>
              <Card className="p-3 space-y-2">
                <div className="flex items-center gap-2 font-medium">
                  <ClipboardCheck size={14} className="text-primary" /> 4. Colar no AdScale
                </div>
                <ol className="list-decimal ml-5 space-y-1 text-muted-foreground">
                  <li>Copie o token gerado (começa com <code>EAAB…</code>).</li>
                  <li>
                    No formulário do app aqui no AdScale, cole no campo{" "}
                    <b>System User Token</b> (ou <b>User Access Token</b> se preferir tratar como user).
                  </li>
                  <li>Salve o cadastro.</li>
                </ol>
              </Card>
              <div className="flex gap-2 text-xs bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30 rounded p-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>
                  Nunca compartilhe o token em prints, e-mail ou chat. Se vazar, revogue pelo BM e gere outro.
                </span>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-3">
              <p className="text-muted-foreground">
                Última etapa — <b>valide dentro do AdScale</b>.
              </p>
              <Card className="p-3 space-y-2">
                <div className="flex items-center gap-2 font-medium">
                  <ShieldCheck size={14} className="text-primary" /> 5. Testar
                </div>
                <ol className="list-decimal ml-5 space-y-1 text-muted-foreground">
                  <li>Clique em <b>Validar conexão</b> no card do app.</li>
                  <li>Confirme que <code>missing_scopes</code> está vazio (nenhuma permissão faltando).</li>
                  <li>Clique em <b>Sincronizar contas</b>.</li>
                  <li>Se aparecer 0 contas, volte ao Passo 2 — o System User não recebeu as contas.</li>
                </ol>
              </Card>
              <div className="text-xs text-muted-foreground border rounded p-2 bg-muted/30">
                Precisa depurar? Consulte <code>meta_diagnostics_log</code> (SQL) para ver o retorno
                real de cada endpoint da Meta.
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex sm:justify-between gap-2">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
          >
            Voltar
          </Button>
          {step < total ? (
            <Button className="gap-1" onClick={() => setStep((s) => Math.min(total, s + 1))}>
              Próximo <ArrowRight size={14} />
            </Button>
          ) : (
            <Button
              className="gap-1"
              onClick={() => window.open("https://business.facebook.com/settings/system-users", "_blank")}
            >
              Abrir BM agora <ExternalLink size={14} />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SystemUserTokenGuide;
