# Cobrança automática no cartão (débito na sexta)

Objetivo: o cliente cadastra um cartão dentro do painel e, toda sexta-feira, o sistema cobra automaticamente o valor total em aberto da semana fechada (comissão da semana + saldo atrasado), sem precisar de Pix manual.

## Como vai funcionar para o cliente

1. No painel, uma nova área "Pagamento automático" mostra um botão para cadastrar cartão.
2. O cartão é digitado direto no formulário seguro do provedor de pagamento — o sistema nunca guarda o número do cartão, só os últimos 4 dígitos, bandeira e validade.
3. O cliente ativa a cobrança automática e vê: cartão salvo, próxima data de cobrança e valor estimado.
4. Toda sexta-feira de manhã o sistema fecha a semana (sexta anterior → quinta), soma o que está em aberto e cobra o cartão.
5. O cliente recebe e-mail com o recibo e vê o pagamento marcado como quitado no extrato.
6. O cliente pode trocar o cartão ou desativar a cobrança automática a qualquer momento (volta para Pix manual).

## Se o cartão for recusado

- Nova tentativa automática em D+1, D+3 e D+5 (3 tentativas).
- A cada falha: e-mail para o cliente e aviso vermelho no painel dele.
- Aviso também no painel do administrador, com lista de cobranças falhadas.
- Após a 3ª falha, a cobrança fica como "pendente manual" e o cliente paga por Pix; não há bloqueio automático de contas.

## Brasil e exterior

- Clientes internacionais: cobrança em dólar via Stripe.
- Clientes do Brasil: cobrança via Mercado Pago (que já está integrado ao sistema), com cartão salvo em cobrança recorrente em real, usando a cotação do dia da cobrança registrada no recibo.
- O sistema escolhe o provedor pelo país do cliente; o admin pode forçar um provedor num cliente específico.

## Painel do administrador

- Nova tela "Cobranças automáticas": clientes com cartão ativo, valor da próxima sexta, histórico de cobranças (paga, falhada, tentativa em andamento).
- Botão para cobrar manualmente antes da sexta ou tentar de novo agora.
- Botão para cancelar/estornar uma cobrança feita por engano.

## Detalhes técnicos

- Novas tabelas: `billing_payment_methods` (cliente, provedor, id do cartão no provedor, últimos 4 dígitos, bandeira, status, padrão) e `billing_charges` (cliente, semana de referência, valor, moeda, provedor, id da transação, status, tentativa, erro, timestamps). RLS: cliente vê só as suas linhas; admin/support veem tudo; GRANT para `authenticated` e `service_role`.
- Fluxo de salvamento do cartão: Stripe SetupIntent (off_session) para exterior; tokenização de cartão do Mercado Pago (customer + card) para Brasil. Nenhum dado sensível trafega pelo nosso banco.
- Novas edge functions:
  - `billing-setup-card` — cria a sessão de cadastro de cartão no provedor certo.
  - `billing-charge-week` — calcula o em aberto a partir de `commissions` / `billing_week_snapshots`, cria a cobrança off-session, grava em `billing_charges`, e ao aprovar atualiza `valor_pago`/`valor_pendente` e lança em `transactions`. Idempotente por (cliente, semana).
  - `billing-webhook` — recebe confirmações e recusas do Stripe e do Mercado Pago e atualiza o status da cobrança.
  - `billing-retry` — reprocessa cobranças recusadas dentro da janela de tentativas.
- Agendamento: um job diário às 09:00 BRT que cobra as semanas fechadas na sexta e processa as tentativas de retry nos demais dias (um único job, não vários). Máximo de atraso: 1 dia.
- Front-end: card "Pagamento automático" no dashboard do cliente (PT/EN/ES), página admin `/cobrancas-automaticas`, avisos de falha no `ClientNotificationCenter`.
- E-mails de recibo e de falha usam a fila de e-mails já existente.

## Pré-requisitos

- Chaves do Stripe (conta da agência) para as cobranças em dólar — vou pedir quando chegarmos nessa etapa.
- Mercado Pago já tem credenciais no sistema; será preciso habilitar cartão salvo/recorrência na conta.
- Vale incluir nos Termos de Uso a autorização de débito recorrente no cartão antes de ativar para os clientes.

## Ordem de entrega

1. Tabelas, cadastro de cartão e cobrança em dólar (Stripe) ponta a ponta.
2. Cobrança automática de sexta + retries + e-mails.
3. Cartão salvo do Mercado Pago para clientes do Brasil.
4. Tela administrativa completa.
