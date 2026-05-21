# Análise geral do AD SCALE

Levantamento rápido do estado atual antes de propor melhorias.

## Estado atual

**Pontos fortes**
- RBAC funcional (admin / support / client) com `user_roles` + `has_role` security definer.
- Integração Meta robusta (BMs, contas, páginas, insights, eventos críticos).
- Modelo de comissões por tiers + crédito FIFO já implementado.
- Auditoria de sync de comissões e logs de acesso já existem.
- Edge Functions cobrindo signup, gestão de usuários, consulta n8n e sync Meta.

**Pontos fracos identificados**

| Área | Observação |
|---|---|
| Arquitetura frontend | `ClientDashboard.tsx` (1331 linhas), `Clients.tsx` (1116), `Dashboard.tsx` (850) — monólitos difíceis de manter |
| Data layer | TanStack Query está instalado mas **não é usado** — todo fetch é `useEffect + setState`, sem cache, sem revalidação, sem dedupe |
| Tipagem | Muito `any` em respostas Supabase; tipos do schema já existem em `types.ts` mas não são aproveitados |
| Tarefas internas (Support) | `tasks` salvas em `localStorage` — sem persistência multi-usuário, sem auditoria |
| Realtime | Não há nenhum canal Realtime; solicitações de cliente, eventos críticos e tarefas exigem refresh manual |
| Validação de formulários | Sem Zod/RHF — validação ad-hoc em vários pontos |
| Mobile | Tela atual desenhada em 1296px; várias grids/cards quebram em viewport menor |
| Observabilidade | Sem error boundary global, sem captura de erros, sem métricas de uso |
| Segurança | Alertas pré-existentes do linter: leaked password protection desativado; algumas funções `security definer` executáveis por anon |
| Performance | `meta_ad_insights` carrega `.limit(50000)` no cliente; reprocessado a cada render do dashboard |
| Backups & rollback | Sem snapshot/exportação de dados financeiros agendada |

## Roadmap proposto (priorizado)

### Fase 1 — Estabilidade & Segurança (1–2 semanas)
1. **Habilitar leaked password protection** no Auth e revisar `SECURITY DEFINER` expostos (linter warnings pendentes).
2. **Error boundary global** + integração com um coletor de erros (ex.: Sentry self-host ou tabela `error_log`).
3. **Migrar `tasks` (Support) do localStorage para o banco**, com RLS, atribuição real ao `support_users` e histórico.
4. **Auditoria estendida**: registrar em `audit_log` cada ação sensível (validar pagamento, criar/excluir cliente, atribuir conta, alterar tier de comissão).
5. **Backup automático semanal** dos lançamentos financeiros e comissões para CSV em Storage.

### Fase 2 — Data layer & Refactor (2–3 semanas)
6. **Adotar TanStack Query** em todas as páginas (clients, commissions, transactions, insights) — cache, retry, invalidação após mutação.
7. **Quebrar monólitos**: extrair de `ClientDashboard` os módulos `OverviewTab`, `BillingTab`, `RequestsTab`, `MetricsCards`. Mesma quebra em `Clients.tsx` e `Dashboard.tsx`.
8. **Tipagem forte**: substituir `any` por tipos derivados de `Database['public']['Tables']`.
9. **Hook único `useClientPortalData(clientId)`** consolidando os fetches paralelos hoje espalhados em `ClientDashboard`.

### Fase 3 — Operacional & UX (2 semanas)
10. **Realtime** para: solicitações de cliente (Support), eventos críticos Meta (badge admin) e tarefas internas — usando `supabase.channel`.
11. **Sexta-feira automática**: edge function agendada gera as cobranças semanais (`weekly_billing`) e dispara WhatsApp via n8n, fechando o ciclo do `mem://features/payment-flow`.
12. **Painel "Sexta de cobrança"**: visão consolidada com cada cliente, valor a cobrar, status do WhatsApp e botão único para validar pagamento.
13. **Mobile-first revisão** das 3 páginas principais (Dashboard, ClientDashboard, Clients) — viewport ≤ 768px.
14. **Validação com Zod + react-hook-form** nos formulários de cliente, transação e solicitação.

### Fase 4 — Inteligência & Crescimento (3+ semanas)
15. **Projeção de receita** na home admin: comissão estimada da semana corrente baseada no ritmo de gasto sincronizado.
16. **Alertas proativos** ao cliente: queda brusca de ROAS, conta bloqueada, saldo Meta abaixo do limite — via notificação in-app e WhatsApp.
17. **Health score por cliente**: composto por ad spend semanal, taxa de aprovação de anúncios, frequência de bloqueio e atraso de pagamento.
18. **Onboarding self-service** do cliente: assistente passo a passo (aceitar termos → conectar BM → escolher páginas → primeira conta atribuída).
19. **Relatório mensal automático** (PDF) entregue ao cliente: gasto, resultados, comissão e comprovantes.

## Detalhes técnicos (resumo)

- **Refactor pattern**: cada aba do ClientDashboard vira componente próprio em `src/pages/client-dashboard/<Tab>.tsx`, e os fetches viram hooks em `src/hooks/queries/*.ts`.
- **Realtime**: habilitar `ALTER PUBLICATION supabase_realtime ADD TABLE …` para `support_requests`, `meta_critical_events`, `internal_tasks`.
- **Cron**: usar Supabase scheduled edge function (`weekly-billing`) toda sexta às 09:00 UTC-3.
- **Auditoria genérica**: tabela `audit_log(actor_id, actor_email, action, entity, entity_id, before, after, created_at)` + helper `logAudit()` chamado nos handlers críticos.
- **Tipos**: criar `src/lib/db-types.ts` reexportando `Tables<'clients'>`, `Tables<'commissions'>`, etc.

## Próximo passo

Confirma quais fases quer priorizar (ou se quer começar por uma melhoria específica da lista) e eu detalho a implementação.
