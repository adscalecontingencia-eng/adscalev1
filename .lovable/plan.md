## Problema

Hoje a rota raiz (`/`) redireciona todo mundo para `/marketplace`, e `/marketplace` é pública. Assim, um cliente de aluguel (role `client`) que faz login cai no painel de compras em vez do dashboard de aluguel dele.

## Objetivo

Cada role deve aterrissar e ficar restrito ao seu próprio painel:

| Role | Destino padrão | Pode acessar marketplace? |
|---|---|---|
| `client` (aluguel) | `/client-dashboard` | ❌ não |
| `partner` | `/partner-dashboard` | ❌ não |
| `admin` / `support` | `/dashboard` | ✅ (admin) |
| `marketplace_client` | `/marketplace` | ✅ |
| anônimo | `/marketplace` (atual) | ✅ |

## Mudanças (somente `src/App.tsx`)

1. **Novo componente `RoleRedirect`** — usa `useAuth()` e devolve um `<Navigate>` para o destino padrão da role logada. Usado em `/` e como guarda em `/marketplace`.

2. **Rota `/`** — passa a usar `RoleRedirect`:
   - sem login → `/marketplace`
   - `client` → `/client-dashboard`
   - `partner` → `/partner-dashboard`
   - `admin`/`support` → `/dashboard`
   - `marketplace_client` → `/marketplace`

3. **Rota `/marketplace`** — envolver num wrapper que, se o usuário logado for `client` ou `partner`, redireciona para o dashboard correto (via `RoleRedirect`). Visitantes não logados e `marketplace_client`/admin continuam vendo normal.

4. **Rotas de marketplace logado** (`/perfil`, `/meus-pedidos`, `/meus-pedidos-marketplace`, `/minhas-compras-pix`) — adicionar `roles={['marketplace_client','admin','support']}` no `ProtectedRoute` para impedir que um `client` de aluguel acesse o painel de compras por URL direta.

5. **Login (`Login.tsx`)** — verificar se já há um redirect pós-login por role; se não tiver, encaminhar para o destino padrão acima. (Edit pequeno só se necessário; sem alterar lógica de auth.)

## Fora de escopo

- Nenhuma alteração no `AuthContext`, banco, RLS ou edge functions.
- Sem mudanças visuais nos dashboards.
