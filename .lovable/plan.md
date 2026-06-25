## Diagnóstico

O erro vindo dos logs é claro:

```
MP error 402 invalid_users_involved
```

Isso **não** é o nome do pagador nem o email `@testuser.com` que resolvem. No sandbox do Mercado Pago, o pagador precisa ser um **Test User** real, criado via API `POST /users/test_user` usando o access token TEST. Qualquer outro email (mesmo `teste@testuser.com`) é rejeitado como "usuário inválido", porque o MP exige que o `payer.email` corresponda a um test user gerado na mesma conta vendedora.

A função `wallet-create-deposit` hoje só reescreve o domínio para `@testuser.com` — o que não basta.

## Plano

Editar **apenas** `supabase/functions/wallet-create-deposit/index.ts` para, quando o token for sandbox (`TEST-...`):

1. Buscar/criar um **test buyer** persistente:
   - Tentar ler de uma secret/env `MP_TEST_BUYER_EMAIL` (cache simples). Se existir, usá-la diretamente como `payer.email`.
   - Se não existir, chamar `POST https://api.mercadopago.com/users/test_user` com `{ site_id: "MLB", description: "AD SCALE buyer" }` usando o access token TEST.
   - Usar o `email` retornado pela API como `payer.email` desta chamada.
   - Logar o email + senha do test user retornado (apenas em sandbox) para o usuário poder reaproveitar.
2. Em produção (token sem prefixo `TEST-`), manter o fluxo atual usando o email real do usuário autenticado.
3. Manter o nome `customer_name` informado pelo cliente como `payer.first_name` (com fallback `APRO` em sandbox, para forçar aprovação automática quando aplicável).
4. Tratar falha da criação do test user retornando 502 com mensagem clara ("Não foi possível criar usuário de teste do Mercado Pago"), em vez do erro genérico atual.

Sem mudanças em UI, banco, RLS, ou em outras edge functions. Sem novas secrets obrigatórias (a `MP_TEST_BUYER_EMAIL` é opcional — se ausente, criamos sob demanda a cada chamada; opcionalmente, recomendarei depois salvar como secret para reuso).

## Detalhes técnicos

Trecho a inserir antes de montar `mpPayload`, em sandbox:

```ts
let payerEmail = email;
if (isSandbox) {
  const cached = Deno.env.get("MP_TEST_BUYER_EMAIL");
  if (cached) {
    payerEmail = cached;
  } else {
    const tuRes = await fetch("https://api.mercadopago.com/users/test_user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ site_id: "MLB", description: "AD SCALE buyer" }),
    });
    const tuData = await tuRes.json();
    if (!tuRes.ok || !tuData?.email) {
      console.error("MP test_user error", tuRes.status, tuData);
      return json({ error: "Falha ao criar usuário de teste MP", details: tuData }, 502);
    }
    payerEmail = tuData.email;
    console.log("MP test buyer created", { email: tuData.email, password: tuData.password });
  }
}
```

E usar `payer: { email: payerEmail, first_name: isSandbox ? "APRO" : name }` no payload.
