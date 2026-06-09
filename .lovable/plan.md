# Plano — Suporte robusto

## 1. Pendências da Agência (nova aba)

Nova aba **"Agência"** em `Support.tsx`, ao lado das atuais.

- Reaproveita `internal_tasks` adicionando coluna `scope` (`'cliente' | 'agencia'`, default `'cliente'`).
- Aba Agência mostra somente `scope='agencia'` (sem `client_id`).
- Categorias fixas no formulário (dropdown):
  Financeiro · Infra/Proxy · Multilogin · Fornecedores · Jurídico · Marketing · Administrativo · Outros.
- Campos: título, descrição, categoria, responsável (`support_users`), prioridade (baixa/média/alta/urgente — nova coluna `priority`), prazo (`due_date`), status (pendente/em_andamento/concluida/cancelada).
- KPIs no topo: total abertas, urgentes, vencidas, concluídas no mês.
- Filtros: categoria, responsável, prioridade, status.

## 2. Painel Visual de BMs (nova aba)

Nova aba **"Painel BMs"** em `Support.tsx` (BMActivityTab continua intacta para histórico/logs diários).

Layout:

```text
┌─ KPIs ──────────────────────────────────────────┐
│ Ativas · Bloqueadas · Sem cliente · Fora backup │
│ Com terceiros · Saúde média                     │
└─────────────────────────────────────────────────┘
┌─ 3 colunas (kanban-like) ────────────────────────┐
│ ATIVAS         │ BLOQUEADAS     │ SEM CLIENTE   │
│ [card BM]      │ [card BM]      │ [card BM]     │
│ [card BM]      │                │ [card BM]     │
└──────────────────────────────────────────────────┘
```

Cada **card de BM** mostra: nome, meta_bm_id, verification badge, contagem de contas (ativas/bloqueadas), badges de alerta (⚠️ fora de backup mínimo, ⚠️ terceiros detectados), e botão "Detalhes".

**Drawer de detalhes da BM**:
- Aba *Usuários*: lista de `business_users + system_users` (via edge `meta-bm-users` já existente). Cada usuário marcado como ✅ Próprio (whitelist) ou 🚩 Terceiro. Botão "Adicionar à whitelist" e botão "Marcar para remoção" (cria task automática em Pendências Agência categoria Fornecedores).
- Aba *Backups*: checkboxes dos backups globais cadastrados; alerta se abaixo do mínimo.
- Aba *Contas*: link para as ad accounts da BM.

## 3. Backups manuais (lista global + regra mínima)

Nova tabela `bm_backups` (catálogo) + `bm_backup_assignments` (qual BM está em qual backup) + configuração de regra mínima.

UI de gestão dentro do Painel BMs → botão "Backups":
- CRUD de backups (nome, descrição, tipo: HD/Drive/Cofre/Outro, última verificação).
- Campo "Mínimo de backups por BM" (default 2).
- Tabela cruzada BM × Backup com checkboxes.
- Alerta global: lista de BMs com `count(backups) < minimo`.

## 4. Whitelist de perfis próprios (detecção de terceiros)

Reutiliza `bm_profiles` (já tem perfis cadastrados manualmente). Adiciona coluna `meta_user_id` opcional para casar com o ID retornado pela Graph API.

Lógica:
- Ao abrir detalhes da BM, edge `meta-bm-users` retorna usuários.
- Sistema compara com `bm_profiles` daquela BM (por `meta_user_id` ou `profile_name`/`email`).
- Não-batidos → flag "Terceiro".
- Botões: "Adicionar à whitelist" (insere em `bm_profiles` com o id Meta), "Criar pendência de remoção" (insere task em `internal_tasks` scope=agencia, categoria=Fornecedores, com referência à BM e usuário).

KPI no painel: nº de BMs com pelo menos 1 terceiro detectado.

---

## Detalhes técnicos

### Migração SQL
```sql
-- 1. Escopo + prioridade + prazo em internal_tasks
ALTER TABLE public.internal_tasks
  ADD COLUMN scope text NOT NULL DEFAULT 'cliente'
    CHECK (scope IN ('cliente','agencia')),
  ADD COLUMN priority text NOT NULL DEFAULT 'media'
    CHECK (priority IN ('baixa','media','alta','urgente')),
  ADD COLUMN due_date date;
CREATE INDEX idx_internal_tasks_scope ON public.internal_tasks(scope);

-- 2. Whitelist: id Meta nos perfis
ALTER TABLE public.bm_profiles
  ADD COLUMN meta_user_id text,
  ADD COLUMN meta_user_kind text,  -- 'business' | 'system'
  ADD COLUMN is_whitelisted boolean NOT NULL DEFAULT true;

-- 3. Backups globais
CREATE TABLE public.bm_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  kind text,  -- HD, Drive, Cofre, Outro
  description text,
  last_verified_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.bm_backups TO authenticated;
GRANT ALL ON public.bm_backups TO service_role;
ALTER TABLE public.bm_backups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin/support full bm_backups" ON public.bm_backups
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'support'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'support'));

-- 4. Cruzamento BM × Backup
CREATE TABLE public.bm_backup_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bm_id uuid NOT NULL REFERENCES public.meta_business_managers(id) ON DELETE CASCADE,
  backup_id uuid NOT NULL REFERENCES public.bm_backups(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(bm_id, backup_id)
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.bm_backup_assignments TO authenticated;
GRANT ALL ON public.bm_backup_assignments TO service_role;
ALTER TABLE public.bm_backup_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin/support full bm_backup_assignments" ON public.bm_backup_assignments
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'support'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'support'));

-- 5. Config global (regra mínima)
CREATE TABLE public.support_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.support_settings TO authenticated;
GRANT ALL ON public.support_settings TO service_role;
ALTER TABLE public.support_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin/support settings" ON public.support_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'support'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'support'));
INSERT INTO public.support_settings(key,value) VALUES ('min_backups_per_bm','2'::jsonb)
  ON CONFLICT DO NOTHING;
```

### Arquivos novos
- `src/components/support/AgencyTasksTab.tsx` — pendências da agência.
- `src/components/support/BMPanelTab.tsx` — painel visual (3 colunas, KPIs, drawer).
- `src/components/support/BMDetailDrawer.tsx` — usuários + backups + ações.
- `src/components/support/BackupsManagerDialog.tsx` — CRUD de backups + matriz BM×Backup + regra mínima.

### Arquivos editados
- `src/pages/Support.tsx` — adiciona 2 novas TabsTrigger ("Agência", "Painel BMs").

### Sem mudanças no backend
A edge `meta-bm-users` já existe e é suficiente. Nenhuma nova edge function necessária.
