# Pedido online → Delivery (Adega FH)

Data: 06/11/2026 · Status: aprovado no chat, aguardando revisão do documento

## Objetivo

O cliente da adega abre um link, monta o pedido e ele chega **direto na tela Delivery** do sistema,
em tempo real e com som, sem comissão. Argumento de venda contra o iFood. Primeiro uso previsto: Adega Premier.

## Decisões tomadas

| Tema | Decisão |
|---|---|
| Onde fica | Página `/pedir` dentro do próprio adega-sistema (mesmo deploy, mesmos produtos, preços e bairros) |
| Pagamento | Na entrega (dinheiro com troco, Pix ou cartão na maquininha). Pix online fica para depois |
| Chegada do pedido | Entra como **"novo"** e só vira "preparando" quando a adega clica **Aceitar**. O estoque baixa no aceite |
| Quem vê | Desligado por padrão. Só liga onde a Vercel tiver `NEXT_PUBLIC_PEDIDO_ONLINE=1` |
| Banco | O SQL roda só no schema da demo (`public`). `magal` e `premier` não são tocados |

## 1. Página do cliente — `app/pedir/page.jsx`

- Celular primeiro, no tema e escala da adega (`C`, `ESCALA`, `MARCA`: logo e nome).
- Se `NEXT_PUBLIC_PEDIDO_ONLINE` não for `1`, a rota mostra "Página não encontrada".
- Cardápio:
  - Produtos `ativo` agrupados por categoria, com busca.
  - Mostra produto sem controle de estoque (copão, drinks) ou com `estoque_atual > 0`.
  - Só aparece produto com preço maior que zero.
- Carrinho fixo embaixo, com total e quantidade.
- Finalização:
  - nome, WhatsApp, endereço, bairro (select dos `bairros`; a taxa aparece), referência;
  - pagamento (dinheiro / Pix / cartão na entrega) e "troco para";
  - observação.
- O nome, o WhatsApp, o endereço, o bairro e a referência ficam salvos no `localStorage` (com try/catch).
- Loja fechada (`configuracoes.pedido_online_aberto = false`) mostra a mensagem "Fechado no momento" e não deixa enviar.
- Depois de enviar, abre `/pedir/acompanhar?id=<uuid>`:
  - linha do tempo Recebido → Aceito → Saiu → Entregue, ou "Recusado";
  - atualiza a cada 15 s;
  - botão de WhatsApp da adega (`configuracoes.telefone`).

## 2. Tela Delivery (só com a variável ligada)

- Bloco **"🔔 Pedidos online"** no topo da lista com os pedidos `status = 'novo'`, mostrando hora, cliente, bairro, itens e total.
- Toca um bip quando chega um novo, pelo canal realtime que já existe (`delivery-rt`).
- **Aceitar**:
  1. confere o estoque (mesma regra do `salvarPedido`);
  2. chama `movimentarEstoque(itens, -1, 'delivery #N')`;
  3. muda o status para `preparando`.
  Dali em diante segue o fluxo atual (saiu → finalizar → caixa).
- **Recusar**: pede o motivo, muda o status para `recusado` e abre o WhatsApp com uma mensagem pronta para o cliente. O estoque não mexe.
- Interruptor **"Recebendo pedidos online: ligado/desligado"**, que grava em `configuracoes.pedido_online_aberto`.
- Link do cardápio (`<origem>/pedir`) com botão Copiar.
- Os pedidos `novo` e `recusado` não entram nos totais, filtros nem relatórios de entregas atuais.

## 3. Banco — `supabase/pedido-online.sql` (rodar por schema)

- `entregas.origem text not null default 'balcao'`. O valor é `'online'` nos pedidos da página.
- `entregas.motivo_recusa text`.
- `configuracoes.pedido_online_aberto boolean not null default true`.
- Função `pedido_online(p_cliente jsonb, p_itens jsonb) returns jsonb`, com `security definer` e `search_path` fixo no schema:
  - valida nome, telefone, endereço e de 1 a 50 itens com quantidade inteira de 1 a 99;
  - confere se a loja está aberta;
  - recalcula preço e subtotal a partir de `produtos` (ignora preço vindo do celular);
  - recusa produto inativo ou com estoque insuficiente (quando controla estoque);
  - pega a taxa de `bairros` pelo nome;
  - limita a 3 pedidos `novo` por telefone;
  - insere em `entregas` com `status='novo'` e `origem='online'`;
  - devolve `{id, numero, total}`.
- Função `status_pedido_online(p_id uuid) returns jsonb`: devolve status, número, total e horários desse pedido.
- `grant execute` para `anon`.
- O script recebe o nome do schema numa variável no topo, igual ao `nova-adega.sql`.

## Limitação conhecida (não piora, mas não resolve)

O sistema hoje dá ao `anon` acesso total às tabelas (`policy acesso_app using (true)`). A chave anon já
fica visível no site de login, então quem souber usá-la consegue ler e alterar dados direto.
As funções acima impedem fraude **pela página**, mas não fecham esse acesso. Endurecer as permissões
(login real + RLS por usuário) é um projeto separado, recomendado antes de ter muitos clientes.

## Testes

Local (Postgres + PostgREST de teste, schema `testeadega`):

1. Cliente faz pedido → aparece em "novo" no Delivery → Aceitar baixa o estoque → Saiu → Finalizar lança no caixa.
2. Pedido com preço alterado no envio → total gravado = preço do cadastro.
3. Loja fechada → função recusa e página mostra "Fechado".
4. Produto sem estoque → recusa com mensagem.
5. 4º pedido pendente do mesmo telefone → recusa.
6. Recusar → status `recusado`, estoque intacto, acompanhamento mostra "Recusado".
7. Sem a variável → `/pedir` não abre e o Delivery fica igual ao de hoje.
8. `npm run build` sem erros.

## Fora do escopo

Pix online, iFood, cupom, pedido mínimo, horário de funcionamento automático, foto dos produtos.
