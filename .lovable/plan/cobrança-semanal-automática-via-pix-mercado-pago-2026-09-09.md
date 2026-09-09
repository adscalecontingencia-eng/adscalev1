# Cobrança semanal automática via Pix (Mercado Pago)

Toda sexta-feira o sistema gera sozinho a cobrança Pix de cada cliente com o valor total em aberto da semana fechada (comissão da semana + saldo atrasado), envia para o cliente e dá baixa automática quando o Pix é pago. Usa a mesma integração Mercado Pago que já funciona no marketplace e na carteira.

Observação importante: o Pix não permite débito automático — o cliente sempre precisa pagar o QR Code. O que fica automático é gerar, enviar, cobrar de novo e dar baixa.

## Como funciona

1. Sexta de manhã o sistema fecha a semana (sexta anterior → quinta) e soma o que está em aberto de cada cliente.
2. Gera um Pix no Mercado Pago com esse valor, com validade até a próxima quinta.
3. O cliente recebe e-mail com o QR Code e o código copia-e-cola, e vê um card "Fatura da semana" no painel com QR, valor, vencimento e status.
4. Quando o Pix é pago, o Mercado Pago avisa o sistema: a fatura vira "paga", a comissão da semana é quitada (valor_pago / valor_pendente atualizados) e a receita é lançada no financeiro — tudo sem ninguém mexer.
5. Se não for pago, o sistema reenvia lembretes automáticos (sábado, segunda e quarta) e marca a fatura como vencida na quinta, somando esse valor na próxima cobrança de sexta.

## Valor em dólar, Pix em real

As comissões são em dólar e o Pix é em real. Na hora de gerar a cobrança o sistema converte usando a cotação do dia (com uma margem de câmbio configurável pelo admin) e registra na fatura: valor em USD, cotação usada e valor em BRL. O recibo mostra os dois valores.

## Painel do cliente

- Card "Fatura da semana": valor, vencimento, QR Code, botão copiar código Pix, status.
- Histórico de faturas com data de pagamento e recibo.
- Aviso vermelho quando há fatura vencida.

## Painel do administrador

- Nova tela "Faturas semanais": todas as faturas da semana com status (aberta, paga, vencida, cancelada), valor USD e BRL.
- Botões: gerar fatura manualmente para um cliente, reenviar cobrança, cancelar fatura, marcar como paga manualmente (com registro de quem fez).
- Resumo: total cobrado, total recebido, total vencido.

## Detalhes técnicos

- Nova tabela `billing_invoices`: cliente, semana de referência (início/fim), valor_usd, cotação, valor_brl, provedor, `mercado_pago_payment_id`, `external_reference` único por (cliente, semana), qr_code, qr_code_base64, status, vencimento, tentativas de lembrete, timestamps. RLS: cliente vê só as próprias faturas; admin/support veem tudo; GRANT para `authenticated` e `service_role`.
- Reaproveita `mercadopago_payments` e `webhook_events` para telemetria, no mesmo padrão da carteira.
- Novas edge functions:
  - `billing-generate-invoices` — calcula o em aberto a partir de `commissions` / `billing_week_snapshots`, converte a moeda e cria o Pix no Mercado Pago. Idempotente por `external_reference`.
  - `billing-invoice-status` — consulta/atualiza uma fatura sob demanda (fallback do webhook), no mesmo formato do `wallet-check-deposit`.
- `mercado-pago-webhook` ganha o tratamento de `billing_invoice`: ao aprovar, chama uma função de banco `settle_invoice_payment` (SECURITY DEFINER, idempotente) que marca a fatura como paga, atualiza `commissions.valor_pago` / `valor_pendente` / `status` e insere em `transactions` como receita `Comissão Semanal` com `source_type='billing_invoice'`.
- Agendamento: um único job diário às 09:00 BRT — na sexta gera as faturas da semana, nos demais dias envia lembretes e marca vencidas. Atraso máximo de 1 dia; rodar uma vez por dia mantém o custo do banco baixo.
- E-mails (fatura, lembrete, recibo, vencida) entram na fila de e-mails existente, em PT/EN/ES.
- Front-end: card de fatura no dashboard do cliente, página admin `/faturas-semanais`, avisos no `ClientNotificationCenter`.

## Ordem de entrega

1. Tabela de faturas + geração do Pix e card no painel do cliente.
2. Webhook dando baixa automática na comissão e no financeiro.
3. Job de sexta + lembretes e vencimento.
4. Tela administrativa e relatórios.
