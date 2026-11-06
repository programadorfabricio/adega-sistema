# Pedido online → Delivery — Plano de execução

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Página pública `/pedir` cujo pedido cai como "novo" na tela Delivery da adega, que aceita (baixa estoque) ou recusa.

**Architecture:** Duas funções `security definer` no schema da adega (`pedido_online`, `status_pedido_online`) recebem e consultam pedidos com preço recalculado no banco. Rotas Next `app/pedir/` (cardápio + acompanhamento) usam o mesmo cliente Supabase do sistema. `Delivery.jsx` ganha um bloco "Pedidos online" isolado num componente novo, tudo atrás de `NEXT_PUBLIC_PEDIDO_ONLINE=1`.

**Tech Stack:** Next.js 16.2 (App Router, JS), React 19, Supabase (Postgres + PostgREST), Playwright para o teste ponta a ponta.

**Spec:** `docs/superpowers/specs/2026-11-06-pedido-online-design.md`

## Global Constraints

- Tudo desligado sem `NEXT_PUBLIC_PEDIDO_ONLINE=1`; Delivery idêntico ao atual nesse caso.
- SQL parametrizado por schema (variável no topo, como `nova-adega.sql`); rodar só em `public` (demo) e `testeadega` (local). Nunca em `magal`/`premier`.
- Status novos em `entregas`: `novo`, `recusado`. `origem`: `'balcao'` (default) | `'online'`.
- Limites: 1–50 itens, quantidade inteira 1–99, máx. 3 pedidos `novo` por telefone.
- Pagamento só na entrega: `dinheiro` | `pix` | `cartao`.
- Textos da interface em português; seguir `C`, `base`, `ESCALA`, `MARCA` de `shared/constants.js`.
- Antes de escrever código Next, ler o guia relevante em `node_modules/next/dist/docs/` (AGENTS.md).
- Testes locais: Postgres em `/var/tmp/pgescola/data` porta 5499 (socket `/tmp`), PostgREST + proxy em `/var/tmp/pgrest`, schema `testeadega`. SQL de teste copiado para `/var/tmp/pgt/sql` (legível pelo usuário postgres).
- Push: `git push origin HEAD:main HEAD:multi-adega` só ao final, com build ok.

## Review Focus

1. Telefone digitado com máscara/espaços ("(19) 99999-0000") — o limite de 3 pendentes deve contar o mesmo número normalizado só em dígitos. → teste em Task 1.
2. Bairro não cadastrado ou vazio (adega sem bairros) — pedido aceito com taxa 0, não erro. → teste em Task 1.
3. Produto desativado ou com estoque zerado entre abrir a página e enviar — função recusa com o nome do produto na mensagem. → teste em Task 1.
4. Duplo clique em "Enviar"/"Aceitar" — não cria dois pedidos nem baixa o estoque duas vezes (botão desabilitado + aceite condicionado a `status='novo'`). → testes em Task 3 e Task 2.
5. `localStorage` indisponível (aba anônima) — página funciona sem lembrar dados. → try/catch em Task 2, checado no e2e da Task 4 com storage bloqueado.

---

### Task 1: SQL — colunas e funções

**Files:**
- Create: `supabase/pedido-online.sql`
- Test: `supabase/testes/pedido-online.test.sql`

**Interfaces:**
- Produces:
  - `entregas.origem text not null default 'balcao'`, `entregas.motivo_recusa text`, `configuracoes.pedido_online_aberto boolean not null default true`.
  - `<schema>.pedido_online(p_cliente jsonb, p_itens jsonb) returns jsonb` → `{"id": uuid, "numero": int, "total": numeric}`; erros via `raise exception` com mensagem em português pronta para mostrar.
    - `p_cliente`: `{nome, telefone, endereco, bairro, referencia, forma_pagamento, troco_para, observacao}`.
    - `p_itens`: `[{produto_id, quantidade}]`. Itens gravados em `entregas.itens` no mesmo formato do Delivery: `{produto_id, nome, quantidade, preco_unitario, subtotal}`.
    - Telefone gravado só com dígitos.
  - `<schema>.status_pedido_online(p_id uuid) returns jsonb` → `{numero, status, total, created_at, saiu_em, entregue_em, motivo_recusa}` ou `null`.
  - `grant execute ... to anon, authenticated`.

- [ ] **Step 1: Escrever o teste** `supabase/testes/pedido-online.test.sql` — bloco `do $$` sobre `testeadega` que cria 2 produtos (um com estoque 5, um com `controla_estoque=false`) e um bairro "Centro" taxa 7, e verifica com `assert`:
  - pedido com `preco` falso no item grava `subtotal` = preço do cadastro × qtd e `total` = subtotal + 7;
  - `status='novo'`, `origem='online'`, telefone "(19) 99999-0000" gravado como `19999990000`;
  - bairro inexistente → taxa 0;
  - quantidade 6 do produto com estoque 5 → exceção contendo o nome do produto;
  - produto inativo → exceção;
  - 4º pedido `novo` do mesmo telefone (com máscara diferente) → exceção;
  - `pedido_online_aberto=false` → exceção "fechad";
  - `status_pedido_online(id)` devolve o status e `null` para uuid aleatório;
  - termina com `rollback` (tudo dentro de `begin; ... rollback;`).
- [ ] **Step 2: Rodar e ver falhar** — `cp supabase/testes/pedido-online.test.sql /var/tmp/pgt/sql/ && psql -h /tmp -p 5499 -U postgres -d postgres -f /var/tmp/pgt/sql/pedido-online.test.sql` → erro "function testeadega.pedido_online does not exist".
- [ ] **Step 3: Implementar `supabase/pedido-online.sql`** com `alvo text := 'public';` no topo, gerando tabelas/funções via `execute format(...)` para o schema; funções com `set search_path = <schema>, public`. Recalcular tudo no banco; ignorar qualquer preço vindo em `p_itens`.
- [ ] **Step 4: Aplicar em `testeadega` e rodar o teste** — trocar `alvo` para `testeadega` numa cópia em `/var/tmp/pgt/sql`, aplicar, rodar o teste → termina sem erro de assert. Rodar o script duas vezes seguidas → sem erro (idempotente).
- [ ] **Step 5: Commit** — `git add supabase/pedido-online.sql supabase/testes && git commit -m "Pedido online: colunas e funções no banco"`.

### Task 2: Página do cliente `/pedir` e `/pedir/acompanhar`

**Files:**
- Create: `app/pedir/page.jsx`, `app/pedir/acompanhar/page.jsx`, `app/pedir/carrinho.js`
- Modify: `app/components/shared/constants.js` (exportar `PEDIDO_ONLINE = process.env.NEXT_PUBLIC_PEDIDO_ONLINE === "1"`)
- Test: `scripts/e2e-pedido.mjs` (criado aqui, completado na Task 4)

**Interfaces:**
- Consumes: `pedido_online`, `status_pedido_online` (Task 1) via `supabase.rpc(nome, args)`.
- Produces: `carrinho.js` com funções puras `adicionar(carrinho, produto)`, `alterarQtd(carrinho, id, qtd)`, `totais(carrinho, taxa) -> {subtotal, total, itens}` e `lerCliente() / salvarCliente(obj)` (localStorage com try/catch, chave `"pedido-cliente-v1"`).

- [ ] **Step 1: Teste das funções puras** — `node --test scripts/carrinho.test.mjs`: adicionar o mesmo produto 2× soma quantidade; `alterarQtd(...,0)` remove; `totais` com taxa 7 e itens 2×10 + 1×5 → `{subtotal:25,total:32}`; `lerCliente()` com `localStorage` lançando erro → `{}`.
- [ ] **Step 2: Rodar e ver falhar** → "Cannot find module".
- [ ] **Step 3: Implementar `carrinho.js`, depois as duas páginas** (client components). `/pedir`: `notFound()`-equivalente quando `!PEDIDO_ONLINE` (texto "Página não encontrada"); carrega `produtos` (ativo, preco>0, estoque>0 ou `controla_estoque=false`), `bairros`, `configuracoes`; categorias + busca; carrinho fixo; formulário; botão Enviar desabilitado enquanto envia; sucesso → `router.push('/pedir/acompanhar?id=<id>')`; erro do RPC mostrado como veio. Loja fechada → aviso e sem botão. `/pedir/acompanhar`: polling 15 s em `status_pedido_online`, linha do tempo, botão WhatsApp (`configuracoes.telefone`).
- [ ] **Step 4: Rodar teste das funções → PASS; `npm run build` → sem erro** (remover Geist de `app/layout.js` só para o build local e `git checkout app/layout.js` depois).
- [ ] **Step 5: Commit** — `git commit -m "Pedido online: página do cliente e acompanhamento"`.

### Task 3: Delivery — bloco "Pedidos online"

**Files:**
- Create: `app/components/delivery/PedidosOnline.jsx`
- Modify: `app/components/Delivery.jsx` (renderizar o bloco no topo quando `PEDIDO_ONLINE`; excluir `novo`/`recusado` das listas/contagens atuais; bip no canal `delivery-rt` em INSERT com `status='novo'`)

**Interfaces:**
- Consumes: `movimentarEstoque(itens, -1, motivo)` de `shared/estoque.js`; `entregas` com `status='novo'`; `configuracoes.pedido_online_aberto`.
- Produces: `<PedidosOnline pedidos={array} onMudou={() => void} />`.

- [ ] **Step 1: Teste** — em `scripts/e2e-pedido.mjs` (Playwright, dev server local com `NEXT_PUBLIC_PEDIDO_ONLINE=1`, schema `testeadega`, login Teste/PIN 1234): criar pedido via RPC → Delivery mostra o cartão em "Pedidos online"; clicar Aceitar duas vezes rápido → estoque do produto baixa exatamente a quantidade 1×; status `preparando`. Recusar outro pedido com motivo → `recusado`, estoque igual, `motivo_recusa` gravado. Interruptor desliga → `configuracoes.pedido_online_aberto=false`.
- [ ] **Step 2: Rodar e ver falhar** → seletor "Pedidos online" não encontrado.
- [ ] **Step 3: Implementar.** Aceitar: `update entregas set status='preparando' where id=? and status='novo' returning *` — só se voltou linha chama `movimentarEstoque` (evita baixa dupla); antes confere estoque como `salvarPedido`. Recusar: `window.prompt` do motivo, update condicionado a `status='novo'`, abre `wa.me` com mensagem pronta. Link `${location.origin}/pedir` com Copiar. Bip curto via `AudioContext` (sem arquivo).
- [ ] **Step 4: Rodar e2e → PASS. Rodar dev sem a variável → Delivery sem bloco e sem diferenças visuais.**
- [ ] **Step 5: Commit** — `git commit -m "Pedido online: aceitar e recusar no Delivery"`.

### Task 4: Ponta a ponta, demo e entrega

**Files:**
- Modify: `scripts/e2e-pedido.mjs` (fluxo completo), `README.md` (seção "Pedido online")

- [ ] **Step 1: Completar o e2e** — cliente abre `/pedir` (celular 390×844), adiciona 2 produtos, escolhe bairro, envia → tela de acompanhamento "Recebido"; adega aceita → acompanhamento mostra "Aceito" no próximo ciclo; saiu → finalizar → venda no caixa com `total` igual. Repetir abrindo `/pedir` num contexto com `localStorage` bloqueado (`addInitScript` que faz o getter lançar) → pedido envia normalmente.
- [ ] **Step 2: Rodar → PASS; screenshots de `/pedir` e do bloco no Delivery (tema escuro e claro) para conferência visual.**
- [ ] **Step 3: README** — como ativar num cliente: rodar `supabase/pedido-online.sql` com `alvo` = schema, setar `NEXT_PUBLIC_PEDIDO_ONLINE=1`, redeploy.
- [ ] **Step 4: Build final (`npm run build`), commit, push `git push origin HEAD:main HEAD:multi-adega`.**
- [ ] **Step 5: Entregar ao Fabrício o SQL para rodar só no schema `public` (demo) + instrução de ligar a variável no projeto Vercel da demo.**
