# Segurança: login da loja + banco trancado por adega (Adega FH)

Data: 07/11/2026 · Status: design aprovado no chat, aguardando revisão do documento
Escopo: só o **adega-sistema**. Escola FH e os outros sistemas vêm depois, reaproveitando este padrão.

## Problema (hoje)

1. A tela de login baixa `usuarios` com o **PIN de todos** e confere no navegador (`app/page.jsx`);
   `Comandas.jsx` também lê `pin` pra confirmar remoção de item. Com F12, aparece o PIN do admin.
2. Todas as adegas estão no mesmo projeto Supabase e usam a mesma chave anon (pública, vai no site).
   Toda tabela tem `policy acesso_app using (true)`: quem tem a chave lê e altera **qualquer** adega.

## Objetivo / critérios de sucesso

- Numa adega trancada, sem a conta da loja **nada** é lido ou gravado, exceto o que é público de propósito
  (cardápio online, envio/acompanhamento de pedido e aviso de mensalidade).
- A conta de uma loja não enxerga outra loja.
- O PIN nunca sai do banco; 5 erros seguidos bloqueiam aquele usuário por 5 minutos.
- O funcionário continua usando nome + PIN; a conta da loja é digitada **uma vez por aparelho**.
- Cada cliente migra quando o Fabrício quiser (variável + SQL por schema), com SQL de destrancar como volta.
- Demo (`public`) continua aberta, sem login da loja.

## Decisões

| Tema | Decisão |
|---|---|
| Identidade | 1 usuário do Supabase Auth por loja (e-mail + senha), `app_metadata.schema = '<schema>'` |
| Funcionários | Continuam na tabela `usuarios` com PIN; o PIN é conferido por função no banco |
| Ligar no app | `NEXT_PUBLIC_LOGIN_LOJA=1` na Vercel do cliente (padrão: desligado = igual hoje) |
| Trancar o banco | `supabase/trancar-adega.sql` por schema; `supabase/destrancar-adega.sql` desfaz |
| Cliente novo | `nova-adega.sql` já cria trancado; `docs/NOVO-CLIENTE.md` ganha o passo da conta da loja |
| Demo | Schema `public` não é trancado |

## 1. Banco (`supabase/trancar-adega.sql`, variável `alvo` no topo, roda de novo sem erro)

Para cada tabela do schema (menos `assinatura`, que já é só leitura):
- remove `acesso_app` (e `acesso_app_config`);
- cria `loja_<tabela>`: `for all to authenticated using (public.schema_da_loja() = '<alvo>') with check (mesmo)`;
- `revoke all ... from anon`.

Funções novas (em `public`, `security definer`, `search_path` fixo, execute só para quem precisa):
- `public.schema_da_loja() returns text` → `auth.jwt() -> 'app_metadata' ->> 'schema'` (usada pelas policies).
- `<alvo>.conferir_pin(p_usuario uuid, p_pin text) returns jsonb` (execute: `authenticated`):
  - exige `schema_da_loja() = alvo`;
  - usuário bloqueado (5 erros nos últimos 5 min em `<alvo>.pin_tentativas`) → `{ok:false, bloqueado_ate}`;
  - errado → registra a tentativa, `{ok:false, restantes}`;
  - certo → limpa as tentativas, `{ok:true, usuario:{id,nome,cargo}}`.
- `<alvo>.cardapio_online() returns jsonb` (execute: `anon`, `authenticated`):
  - `{loja:{nome, telefone, aberto}, bairros:[{nome,taxa}], produtos:[{id,nome,categoria,preco,estoque_disponivel?}]}`;
  - só produtos ativos, com preço > 0 e (sem controle de estoque ou estoque > 0). Não devolve custo.
  - `estoque_atual` só é devolvido pra limitar a quantidade no carrinho, sem outros campos.
- `public.ping() returns boolean` (execute: `anon`) para o keepalive, sem ler tabela de cliente.

PIN escondido na tabela `usuarios`:
- `revoke select on <alvo>.usuarios from authenticated`;
- `grant select (id, nome, cargo, ativo, created_at) on <alvo>.usuarios to authenticated`;
- `insert`/`update`/`delete` continuam liberados para a conta da loja (Configurações cria e troca PIN).
- Consequência: nenhuma chamada do app em `usuarios` pode usar `select("*")` nem `.select()` depois de insert/update
  (o `returning *` pediria a coluna `pin` e daria erro de permissão).

Tabela nova `<alvo>.pin_tentativas(usuario_id uuid, em timestamptz default now())`, sem acesso para `anon`/`authenticated`
(só as funções escrevem).

`supabase/destrancar-adega.sql`: recria `acesso_app` em todas as tabelas, devolve os grants de `anon` e o `select` completo
de `usuarios`. As funções novas ficam (não atrapalham).

Ligar a conta ao schema (Fabrício roda depois de criar o usuário em Authentication → Add user):
```sql
update auth.users set raw_app_meta_data = raw_app_meta_data || '{"schema":"premier"}' where email = 'loja.premier@...';
```

## 2. App (adega-sistema)

- `app/components/shared/constants.js`: `LOGIN_LOJA = process.env.NEXT_PUBLIC_LOGIN_LOJA === "1"`.
- `app/page.jsx`:
  - com `LOGIN_LOJA` e sem sessão do Supabase → tela **"Entrar com a conta da loja"** (e-mail, senha, botão Entrar);
  - login ok mas `app_metadata.schema` ≠ `SCHEMA` → sai da conta e mostra "Essa conta não é desta adega";
  - lista de usuários do PIN: `select("id, nome, cargo, ativo")` (nunca `*`);
  - conferência do PIN:
    - com `LOGIN_LOJA` → `rpc("conferir_pin")`, mostrando "PIN incorreto (restam N)" / "Bloqueado por 5 min";
    - sem `LOGIN_LOJA` → comparação atual (adega ainda não migrada).
- `Comandas.jsx` (confirmar remoção de item com PIN): mesma regra (`conferir_pin` com `LOGIN_LOJA`).
- `Configuracoes.jsx`:
  - a lista de usuários usa colunas sem `pin`; editar usuário só manda `pin` se foi digitado um novo;
  - botão **"Sair da conta da loja"** (só admin, só com `LOGIN_LOJA`), que pede confirmação.
- `app/pedir/page.jsx` e `app/pedir/acompanhar/page.jsx`: usam `rpc("cardapio_online")` no lugar dos `select` diretos
  (funciona trancado ou não).
- `app/api/keepalive/route.js`: `rpc("ping")`.
- O tempo real e o `useRecarregar` não mudam (o supabase-js manda o token da sessão sozinho).

## 3. Cliente novo e documentação

- `nova-adega.sql`: no fim, `perform public.instalar_trava(novo)`. A lógica do `trancar-adega.sql` vira a função instaladora
  `public.instalar_trava(alvo)`, com execute revogado de `anon`/`authenticated`, no mesmo padrão do `instalar_pedido_online`.
- `docs/NOVO-CLIENTE.md`:
  - passo "Conta da loja": criar o usuário + o SQL do `app_metadata`;
  - variável `NEXT_PUBLIC_LOGIN_LOJA=1`;
  - no dia da implantação, entrar com a conta em cada aparelho.
- Passo a passo de migração de cliente existente (Magal), na ordem:
  1. criar a conta da loja e ligar ao schema;
  2. `NEXT_PUBLIC_LOGIN_LOJA=1` + Redeploy;
  3. o cliente entra com a conta (banco ainda aberto, tudo funciona);
  4. rodar `trancar-adega.sql` com `alvo='magal'`;
  5. venda teste. Se algo falhar → `destrancar-adega.sql`.

## Testes (banco local, schemas `testeadega` e um segundo `testeoutra`)

SQL (`supabase/testes/trava.test.sql`, simulando `anon` e `authenticated` com `set local role` + `request.jwt.claims`):
1. `anon` não lê nem grava nenhuma tabela da adega trancada; `cardapio_online`, `pedido_online` e `status_pedido_online` funcionam.
2. `authenticated` com schema `testeoutra` não lê nem grava `testeadega`.
3. `authenticated` da loja lê e grava normalmente; `select pin from usuarios` é negado.
4. `conferir_pin`: certo → ok; 5 errados → bloqueado (inclusive com o PIN certo) até passar 5 min; certo depois do bloqueio limpa.
5. `cardapio_online` não devolve `preco_custo`.
6. `destrancar-adega.sql` volta o `anon` a ler; rodar `trancar` 2× não dá erro.

E2E (Playwright, dev com `NEXT_PUBLIC_LOGIN_LOJA=1` e PostgREST local com JWT da loja):
7. Sem sessão → tela da conta da loja; senha errada → mensagem; conta de outra adega → "não é desta adega".
8. Login da loja → PIN → Venda Rápida → Comanda (remover item com PIN) → Delivery → Caixa, tudo gravando.
9. Nenhuma resposta de rede contém o campo `pin`.
10. `/pedir` com a adega trancada: cardápio carrega e o pedido chega no Delivery.
11. Sem `NEXT_PUBLIC_LOGIN_LOJA` (adega aberta) → comportamento atual; o e2e existente continua passando.

Observação de teste local: o PostgREST local precisa de `jwt-secret` configurado para aceitar o token da loja; o teste gera
o JWT com o mesmo segredo (sem Supabase Auth local). O `signInWithPassword` é coberto num teste que intercepta
`/auth/v1/token` e devolve esse JWT.

## Fora do escopo

Escola FH e demais sistemas (próximos projetos); login individual por funcionário; 2FA; auditoria de ações por usuário.
