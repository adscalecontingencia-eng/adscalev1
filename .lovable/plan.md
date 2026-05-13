## Objetivo
Notificar via WhatsApp (n8n) os clientes quando ocorrerem eventos críticos nas estruturas Meta vinculadas a eles: conta banida, BM restrita, anúncio rejeitado e página banida.

---

## Parte 1 — Banco de dados

**Nova tabela `meta_critical_events`** (auditoria + idempotência + retry):
- `event_type`: `account_banned` | `bm_restricted` | `ad_rejected` | `page_banned`
- `severity`: `critical` | `high`
- `ad_account_id`, `bm_id`, `client_id` (FK lógica), `entity_meta_id`, `entity_name`
- `reason`, `details jsonb`
- `detected_at`, `notified_at`, `notify_status` (`pending|sent|failed|skipped`)
- `dispatch_log_id` → liga ao `whatsapp_dispatch_log` existente
- Constraint única: `(event_type, entity_meta_id, detected_at::date)` para não duplicar no mesmo dia

**Sync de páginas e ads (novo)** — hoje só temos contagens. Para detectar `ad_rejected` e `page_banned` precisamos sincronizar:
- `meta_pages`: `meta_page_id`, `bm_id`, `name`, `is_published`, `is_restricted`, `last_synced_at`
- `meta_ads`: `meta_ad_id`, `ad_account_id`, `name`, `effective_status`, `disapproval_reason`, `last_synced_at`

---

## Parte 2 — Edge Function `meta-critical-monitor`

Roda em duas situações:
1. **Automático**: chamada no fim do `meta-sync` após cada `sync_accounts` / `sync_insights`.
2. **Manual**: botão no painel admin "Verificar eventos críticos agora" + botão "Reenviar" por evento.

Lógica:
- Compara estado atual (Meta) vs último estado salvo:
  - `account_status != 1` ou `disable_reason > 0` que antes era 0 → `account_banned`
  - BM `verification_status` mudou para `not_verified`/`disabled` → `bm_restricted`
  - Ad com `effective_status` em `DISAPPROVED|WITH_ISSUES` → `ad_rejected`
  - Page com `is_restricted=true` ou some da listagem → `page_banned`
- Para cada evento detectado:
  - Resolve `client_id` via `meta_ad_account_assignments` (eventos sem cliente atribuído ficam `skipped` — só log, sem WhatsApp)
  - Insere em `meta_critical_events`
  - Se cliente tem `whatsapp_phone` e `notify_whatsapp=true`, dispara webhook n8n
  - Registra resultado em `whatsapp_dispatch_log`

---

## Parte 3 — Webhook n8n

Payload enviado (POST):
```json
{
  "event_type": "account_banned",
  "severity": "critical",
  "client": { "id": "...", "name": "...", "phone": "5511..." },
  "entity": { "type": "ad_account", "meta_id": "act_123", "name": "Conta XYZ" },
  "reason": "ADS_INTEGRITY_POLICY",
  "detected_at": "2026-05-13T15:00:00Z",
  "message": "🚨 *AD SCALE* — Conta de anúncio *XYZ* foi BANIDA. Motivo: ADS_INTEGRITY_POLICY. Nossa equipe já foi acionada.",
  "portal_link": "https://adscalev1.lovable.app/#/login"
}
```

Headers:
- `Content-Type: application/json`
- `X-Lovable-Token: <N8N_WEBHOOK_TOKEN>`

Templates de mensagem (PT-BR) por `event_type` formatados na própria edge function — você só repassa `message` no n8n.

**Secrets necessários** (peço quando confirmar):
- `N8N_CRITICAL_WEBHOOK_URL`
- `N8N_WEBHOOK_TOKEN` (pode ser o mesmo já existente)

---

## Parte 4 — UI Admin

Nova página (ou aba dentro de `BlockLog`) **"Eventos Críticos"**:
- Lista cronológica com filtro por tipo/cliente/status
- Badge de severidade e canal (WhatsApp enviado / falhou / sem cliente)
- Botão **Verificar agora** (chama `meta-critical-monitor` action=`check`)
- Botão **Reenviar WhatsApp** por linha (action=`resend`, billing_id=event_id)
- Indicador de último check

---

## Detalhes técnicos
- Sync de pages/ads adiciona ~2 chamadas extras por BM/conta — concorrência limitada como já é feito em `meta-sync`.
- Fontes Meta: `/me/businesses/{bm}/owned_pages` (já chamado, só persistir) + `/{ad_account_id}/ads?fields=effective_status,issues_info,name`.
- Idempotência: constraint única evita duplicar evento + `notified_at` evita reenvio automático (só manual).
- RLS: tabelas novas com policy `admin/support full` + `clients read own` (se quiser exibir no painel do cliente depois).
- Envio usa `SUPABASE_SERVICE_ROLE_KEY` para bypass.

---

## O que preciso de você
1. Confirmar o plano (especialmente: criar `meta_pages` e `meta_ads` para detectar rejeição/banimento — sem isso esses 2 eventos ficam impossíveis).
2. Após aprovado, eu peço os 2 secrets do n8n.
3. Você cria o workflow n8n com nó Webhook + envio para o WhatsApp (`{{ $json.client.phone }}` / `{{ $json.message }}`).