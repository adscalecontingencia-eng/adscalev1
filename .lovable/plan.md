## Diagnóstico

Verifiquei o banco e a sincronização está funcionando:

```
 date       | linhas | spend
 2026-06-27 |   64   |  8567.51   ← Hoje
 2026-06-26 |   73   | 15125.03   ← Ontem
 2026-06-25 |   76   |  9560.90
```

Ou seja, os dados existem em `meta_ad_insights`, o `meta-sync` está populando corretamente, e os GRANTs/RLS permitem o admin/support enxergar tudo. O problema não é o sync — é o front-end (`src/pages/AdsDashboard.tsx`) que está renderizando "Nenhum insight encontrado" mesmo com dados disponíveis nas janelas curtas (Hoje/Ontem).

## Causas-raiz no `AdsDashboard.tsx`

1. **Stale closure no auto-sync**
   ```ts
   await loadInsights();
   const hasToday = insights.some(i => i.date === today); // 'insights' é do render anterior
   ```
   `insights` lido logo após `await loadInsights()` ainda é o valor antigo do render, então `hasToday` é sempre `false` na primeira execução, disparando `sync({forceRecent:true})` sempre — e o `loadInsights({background:true})` disparado depois pode sobrescrever o estado durante uma corrida.

2. **Race do generation guard (`loadGen`) deixando `insights = []`**
   `loadInsights` faz `++loadGen.current` no início e, se outro `loadInsights` (do sync, do useEffect, do StrictMode) bumpa a geração antes do primeiro responder, o primeiro faz `return` sem chamar `setInsights` **nem** `setLoading(false)`. Em janelas curtas (Hoje/Ontem = poucas linhas, resposta rápida) a corrida fica visível e o estado final pode ficar com `insights = []` (estado inicial), enquanto `loading` já foi resetado por outra chamada — exatamente a tela do print: 443 contas, sem skeleton, sem linhas.

3. **Auto-sync silencioso esconde falha real**
   Quando o `sync({silent:true, forceRecent:true})` falha (Meta instável, erros parciais em 100+ contas), o front-end limpa o `autoSyncError` no fluxo de sucesso seguinte e o usuário não tem nenhuma pista do motivo da tela vazia.

## Correções

### `src/pages/AdsDashboard.tsx`

1. Fazer `loadInsights` **retornar** as linhas carregadas e usar esse retorno no auto-sync, em vez de ler o state `insights` (que é stale):
   ```ts
   const rows = await loadInsights();
   const hasToday = rows.some(i => i.date === today);
   ```
2. No `loadInsights`, garantir sempre `setLoading(false)` no `finally`, inclusive quando o generation guard descarta o resultado, para nunca deixar o componente travado num estado inconsistente.
3. Tornar o auto-sync seguro contra corridas: cancelar/ignorar o `loadInsights({background:true})` final do `sync` se o `range` já mudou (já há `loadGen`, basta capturar `gen` antes do sync e abortar caso difira no fim).
4. Para `range === "today" | "yesterday"`, se a query inicial vier vazia **e** existirem contas, mostrar skeleton + disparar um `sync({forceRecent:true})` foreground e recarregar — em vez de cair direto no empty-state.
5. Mostrar o erro do auto-sync no banner amarelo também quando vier `data.erros.length > 0` na primeira execução (hoje só aparece em re-execuções), para o admin enxergar quando a Meta devolveu falha parcial.

### Sem alterações em backend/sync

`supabase/functions/meta-sync/index.ts` está correto (usa `time_range: {since, until}` com datas locais vindas do front, faz upsert em `(ad_account_id, date)`), e o DB tem os dados. Nenhuma migração nem mudança de RLS é necessária.

## Validação

- Abrir `/ads`, alternar entre Hoje / Ontem / 7d várias vezes seguidas — não pode mais ficar em "Nenhum insight" quando o DB tem linhas (confirmar contra a query SQL acima).
- Forçar uma falha do `meta-sync` (token inválido temporário) e confirmar que o banner amarelo aparece com a mensagem real.
- Verificar no console que `loadInsights` não fica preso em `loading=true` após disparos rápidos consecutivos.
