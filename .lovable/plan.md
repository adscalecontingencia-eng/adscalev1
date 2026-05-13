## Objetivo
1. Gerar automaticamente a `weekly_billing` de cada cliente toda **sexta-feira** com base no contrato (fixo, % ou ambos).
2. Disparar a mensagem de cobrança no **WhatsApp do cliente** via webhook do agente n8n existente.

---

## Parte 1 — Geração automática (Cron)

### 1.1 Schema
Adicionar colunas em `clients`:
- `whatsapp_phone TEXT` — número no formato internacional (ex: `5511999999999`)
- `notify_whatsapp BOOLEAN DEFAULT true` — opt-in da notificação automática

Adicionar campo no formulário admin (`Clients.tsx`) para preencher esses dados.

### 1.2 Edge Function `generate-weekly-billings`
Para cada cliente:
- Calcular semana corrente (Seg–Dom).
- Verificar se já existe `weekly_billing` com `billing_week_start` igual → ignorar (idempotente).
- Somar `ad_spend` e `amount` das `commissions` daily da semana.
- Calcular comissão final pelo contrato:
  - `fixed`: `fixed_value`
  - `percentage`: `ad_spend * percentage_value/100`
  - `both`: soma dos dois
- Inserir `weekly_billing` (`status: 'pendente'`, `valor_pendente = amount`).
- Se `notify_whatsapp` e `whatsapp_phone`, chamar o webhook do n8n com payload (ver Parte 2).

### 1.3 Agendamento (pg_cron)
Habilitar `pg_cron` + `pg_net` e agendar para **toda sexta às 12:00 (horário de Brasília = 15:00 UTC)**:
```sql
select cron.schedule(
  'weekly-billing-friday',
  '0 15 * * 5',
  $$ select net.http_post(
       url:='https://<project>.supabase.co/functions/v1/generate-weekly-billings',
       headers:='{"Content-Type":"application/json","apikey":"<anon>"}'::jsonb,
       body:='{}'::jsonb
     ); $$
);
```
Adicionar botão **"Rodar agora"** no admin para disparo manual de teste.

---

## Parte 2 — Envio WhatsApp via n8n

### 2.1 No n8n (você faz)
1. Criar workflow novo com trigger **Webhook (POST)** — copiar a URL gerada.
2. Adicionar header de autenticação (ex: `X-Lovable-Token`) com um valor secreto.
3. Após o Webhook, conectar o nó do seu agente WhatsApp (Evolution API / WhatsApp Business / Z-API — o que você já usa) com:
   - destinatário = `{{ $json.phone }}`
   - mensagem = `{{ $json.message }}` (template já formatado pela Edge Function)
4. Ativar o workflow.

### 2.2 No Lovable (eu faço)
1. Pedir 2 secrets: `N8N_WEBHOOK_URL` e `N8N_WEBHOOK_TOKEN`.
2. Na Edge Function, após criar a `weekly_billing`, fazer:
```ts
await fetch(N8N_WEBHOOK_URL, {
  method: 'POST',
  headers: { 'Content-Type':'application/json', 'X-Lovable-Token': N8N_WEBHOOK_TOKEN },
  body: JSON.stringify({
    client_id, client_name, phone: whatsapp_phone,
    amount, week_start, week_end, due_date, // sexta
    payment_link: 'https://adscalev1.lovable.app/#/login',
    message: `Olá ${nome}! Sua cobrança semanal AD SCALE de ${valor} referente a ${periodo} está disponível. Vencimento: hoje (sexta). Acesse seu painel: ...`
  })
});
```
3. Logar a tentativa em uma nova tabela `whatsapp_dispatch_log` (status, response, error) para auditoria e retry.

### 2.3 Botão manual de reenvio
No painel admin, em cada cobrança pendente, botão **"Reenviar WhatsApp"** que chama a mesma function com `billing_id` específico.

---

## Detalhes técnicos
- Função usa `SUPABASE_SERVICE_ROLE_KEY` (já disponível) para bypass de RLS.
- Idempotência via constraint lógica `(client_id, billing_week_start)` em `commissions` do tipo `weekly_billing`.
- `verify_jwt = false` (chamada por cron sem usuário).
- Mensagem em PT-BR, valor em USD com formatação `$1,234.56`.

---

## O que preciso de você
1. Confirmar que posso prosseguir com a implementação.
2. Adicionar os secrets `N8N_WEBHOOK_URL` e `N8N_WEBHOOK_TOKEN` quando eu pedir.
3. Confirmar o **horário** da cobrança (proponho **sexta 12:00 BRT**).
4. Confirmar o **template da mensagem** (ou aprovar o sugerido acima).
