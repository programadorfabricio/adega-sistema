# Segurança: login da loja + banco trancado — Plano de execução

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adega trancada só é lida/gravada pela conta da loja dela; PIN conferido no banco; cardápio online e pedido continuam públicos.

**Architecture:** Funções `security definer` + policies RLS por schema exigindo `auth.jwt()->'app_metadata'->>'schema' = '<schema>'`. Instaladores `public.instalar_trava(alvo)` (trancar) e `cardapio_online` dentro de `public.instalar_pedido_online(alvo)`. App ganha tela de conta da loja e PIN por RPC atrás de `NEXT_PUBLIC_LOGIN_LOJA=1`.

**Tech Stack:** Next.js 16.2 (JS), supabase-js, Postgres/PostgREST, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-07-seguranca-login-loja-design.md`

## Global Constraints

- Sem `NEXT_PUBLIC_LOGIN_LOJA=1`: app idêntico ao de hoje (PIN comparado no navegador); e2e atual (`scripts/e2e-pedido.cjs tudo`) continua passando.
- Schema `public` (demo) nunca é trancado. SQL nunca roda em `magal`/`premier` nos testes.
- Claim: `auth.jwt() -> 'app_metadata' ->> 'schema'`. Bloqueio do PIN: 5 erros em 5 min → bloqueado até 5 min após o 5º erro.
- `usuarios`: nenhuma chamada do app usa `select("*")` nem `.select()` após insert/update (coluna `pin` sem grant de select).
- `cardapio_online` não devolve `preco_custo` nem colunas além das do spec.
- Funções instaladoras (`public.instalar_*`): execute revogado de `public, anon, authenticated`.
- Local: Postgres `/var/tmp/pgescola/data` :5499; PostgREST em `/var/tmp/pgrest` (pr.conf + proxy.js); schemas de teste `testeadega` e `testeoutra`. Local não tem schema `auth`: o teste cria o stub `auth.jwt()` = `current_setting('request.jwt.claims', true)::jsonb` só se não existir.
- Push só no fim: `git push origin HEAD:main HEAD:multi-adega`.

## Review Focus

1. Sessão da loja expirada/renovada no meio do dia (token refresh) — app não pode cair pra tela de conta da loja enquanto o refresh funciona. → Task 3 e2e: recarregar a página com sessão salva vai direto ao PIN.
2. Admin troca o PIN em Configurações e depois entra com o PIN novo — tem que funcionar com a coluna escondida. → Task 3 e2e.
3. Usuário desativado (`ativo=false`) tenta PIN certo — `conferir_pin` recusa. → Task 2 teste SQL.
4. `conferir_pin` com uuid de usuário de outra loja / inexistente — `{ok:false}` sem revelar nada. → Task 2 teste SQL.
5. Cardápio com a adega trancada e loja fechada — `/pedir` mostra "Fechado" (vem do `cardapio_online`). → Task 4 e2e.

---

### Task 1: `cardapio_online` no instalador do pedido online

**Files:** Modify `supabase/pedido-online.sql`; Test `supabase/testes/pedido-online.test.sql` (novos asserts)

**Interfaces — Produces:** `<s>.cardapio_online() returns jsonb` (stable, security definer, search_path `<s>, pg_temp`, execute `anon, authenticated`) →
`{"loja":{"nome":text,"telefone":text,"aberto":bool},"bairros":[{"nome","taxa"}],"produtos":[{"id","nome","categoria","preco","controla_estoque","estoque_atual"}]}`; produtos: ativo, preco>0, (controla_estoque=false ou estoque_atual>0), ordenados por categoria, nome.

- [ ] Step 1: asserts novos: produto ativo aparece; inativo e com estoque 0 (controlado) não; copão sem controle aparece; chave `preco_custo` ausente em todo item; `loja.aberto` reflete `pedido_online_aberto`; anon tem execute.
- [ ] Step 2: rodar → FAIL "function testeadega.cardapio_online does not exist".
- [ ] Step 3: implementar dentro de `public.instalar_pedido_online`.
- [ ] Step 4: aplicar e rodar → `OK: todos os testes de pedido online passaram`.
- [ ] Step 5: commit "Pedido online: cardapio_online sem custo".

### Task 2: Trava do banco (SQL)

**Files:** Create `supabase/trava.sql` (instalador + `alvo`), `supabase/destrancar-adega.sql`, `supabase/testes/trava.test.sql`; Modify `supabase/nova-adega.sql` (passo 9: `perform public.instalar_trava(novo)` se existir)

**Interfaces — Produces:**
- `public.schema_da_loja() returns text` (stable; execute anon, authenticated).
- `public.ping() returns boolean` (execute anon).
- `public.instalar_trava(alvo text)` / `public.destrancar(alvo text)` (execute revogado).
- `<s>.pin_tentativas(usuario_id uuid, em timestamptz default now())`, sem grants pra anon/authenticated.
- `<s>.conferir_pin(p_usuario uuid, p_pin text) returns jsonb`: `{ok:true, usuario:{id,nome,cargo}}` | `{ok:false, restantes:int}` | `{ok:false, bloqueado_ate:timestamptz}`; recusa usuário inexistente/inativo como `{ok:false, restantes:...}` sem detalhar. Exige `schema_da_loja() = '<s>'` **ou** schema não trancado (sem policy `loja_%`): assim funciona antes de trancar (passo 3 da migração).
- Policies `loja_<tabela>` em todas as tabelas base do schema menos `assinatura` e `pin_tentativas`.

- [ ] Step 1: `trava.test.sql` (dentro de `begin … rollback`, com stub `auth.jwt()`), simulando papéis com `set local role anon|authenticated` e `set_config('request.jwt.claims', '{"role":"authenticated","app_metadata":{"schema":"..."}}', true)`:
  - anon: `select` em produtos/vendas/usuarios → erro de permissão; `insert` em vendas → erro; `cardapio_online()` e `status_pedido_online()` ok.
  - authenticated testeoutra: `select count(*) from testeadega.produtos` = 0 linhas visíveis ou erro; insert → erro de RLS.
  - authenticated testeadega: lê produtos, insere/apaga venda; `select pin from usuarios` → erro; `select id,nome from usuarios` ok; `update usuarios set pin='4321'` ok.
  - `conferir_pin`: certo → ok; usuário inativo → ok=false; uuid aleatório → ok=false; 5 errados → 6ª com PIN certo = bloqueado_ate; avançar: `update pin_tentativas set em = em - interval '6 min'` → certo = ok e tentativas limpas.
  - rodar `instalar_trava` 2× sem erro; `destrancar('testeadega')` → anon volta a ler produtos.
- [ ] Step 2: rodar → FAIL "function public.instalar_trava does not exist".
- [ ] Step 3: implementar `trava.sql` e `destrancar-adega.sql`; `nova-adega.sql` chama `instalar_trava(novo)` no fim.
- [ ] Step 4: rodar `trava.test.sql` → `OK: trava`; `scripts/testar-nova-adega.sh` ganha assert "anon não lê testenovo.produtos" → OK.
- [ ] Step 5: commit "Trava do banco por adega (SQL)".

### Task 3: App — conta da loja e PIN pelo banco

**Files:** Create `app/components/shared/ContaLoja.jsx` (tela e-mail/senha); Modify `app/components/shared/constants.js` (`LOGIN_LOJA`), `app/page.jsx`, `app/components/Comandas.jsx:405-415`, `app/components/Configuracoes.jsx` (lista sem pin, update sem returning, botão "Sair da conta da loja"); `app/api/keepalive/route.js` (`rpc("ping")`). Test `scripts/e2e-seguranca.cjs`.

**Interfaces — Consumes:** `conferir_pin`, `schema_da_loja` (Task 2). **Produces:** `LOGIN_LOJA: boolean`; `conferirPin(usuarioId, pin) -> Promise<{ok, restantes?, bloqueado_ate?, usuario?}>` em `app/components/shared/pin.js` (com LOGIN_LOJA usa RPC; sem, compara com `pin` buscado só nesse caso).

- [ ] Step 1: infra de teste local: `pr.conf` com `jwt-secret` (32+ chars) e `db-schemas = "testeadega, testeoutra"`; `proxy.js` repassa `Authorization` só quando começa com `Bearer eyJ`. `e2e-seguranca.cjs` gera JWT HS256 (`crypto.createHmac`) com `{role:"authenticated", app_metadata:{schema}, exp}` e intercepta `**/auth/v1/token**` devolvendo `{access_token, refresh_token:"x", token_type:"bearer", expires_in:3600, user:{id, app_metadata:{schema}}}`; `**/auth/v1/user**` devolve o user. Testes:
  - sem sessão → texto "Entrar com a conta da loja"; conta com schema `testeoutra` → "Essa conta não é desta adega";
  - conta certa → tela do PIN; recarregar a página → direto no PIN (sessão salva);
  - PIN errado → "PIN incorreto"; certo → entra; Venda Rápida finaliza venda (linha nova em `vendas`);
  - Comandas: remover item pedindo PIN funciona;
  - Configurações: trocar PIN do usuário Teste para 5678, sair, entrar com 5678;
  - nenhuma resposta de `/rest/v1/` contém `"pin"`;
  - "Sair da conta da loja" volta para a tela da conta.
- [ ] Step 2: rodar com dev `NEXT_PUBLIC_LOGIN_LOJA=1` na porta 3004 e `testeadega` trancado → FAIL no primeiro texto.
- [ ] Step 3: implementar.
- [ ] Step 4: `e2e-seguranca.cjs` → PASSOU; destrancar `testeadega` e rodar `e2e-pedido.cjs tudo` no dev sem a variável (3002) → PASSOU; `npm run build` ok.
- [ ] Step 5: commit "Login da loja e PIN conferido no banco".

### Task 4: Cardápio público pela função + documentação

**Files:** Modify `app/pedir/page.jsx` (carregar via `rpc("cardapio_online")`), `app/pedir/acompanhar/page.jsx` (loja via `cardapio_online().loja`), `docs/NOVO-CLIENTE.md`, `README.md`; Create `docs/MIGRAR-CLIENTE-SEGURANCA.md` (passo a passo do Magal).

- [ ] Step 1: e2e em `e2e-seguranca.cjs`: com `testeadega` trancado, `/pedir` (sem sessão) carrega "Cerveja E2E", envia pedido, e ele aparece no Delivery da conta da loja; com `pedido_online_aberto=false` → "Fechado no momento".
- [ ] Step 2: rodar → FAIL (cardápio vazio: anon sem select).
- [ ] Step 3: implementar; docs: conta da loja (Authentication → Add user + `update auth.users set raw_app_meta_data = raw_app_meta_data || '{"schema":"<s>"}' where email = '<e-mail>'`), variável `NEXT_PUBLIC_LOGIN_LOJA=1`, ordem de migração do spec e o SQL de destrancar.
- [ ] Step 4: todas as suítes: SQL (pedido-online, trava, tempo-real, nova-adega), unit (`carrinho`, `recarregar`), e2e (`e2e-pedido tudo` destrancado, `e2e-seguranca` trancado), build → verdes.
- [ ] Step 5: commit; revisão final; push.
