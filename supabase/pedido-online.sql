-- ============================================================
-- PEDIDO ONLINE: o cliente pede pela página /pedir e o pedido
-- cai como "novo" na tela Delivery da adega.
--
-- Como usar (Supabase → SQL Editor):
--   1. Troque 'public' abaixo pelo schema da adega que vai usar
--      (public = demonstração Império). Rode só nas adegas que contrataram.
--   2. Rode o script inteiro. Pode rodar de novo sem erro.
--   3. No deploy da Vercel dessa adega: NEXT_PUBLIC_PEDIDO_ONLINE=1
--
-- Segurança: o preço, a taxa e o estoque são conferidos aqui no banco.
-- O que vem do celular do cliente é só "qual produto e quantos".
-- ============================================================

do $$
declare
  alvo text := 'public';   -- <<< SCHEMA DA ADEGA
begin
  execute format('alter table %I.entregas add column if not exists origem text not null default %L', alvo, 'balcao');
  execute format('alter table %I.entregas add column if not exists motivo_recusa text', alvo);
  execute format('alter table %I.configuracoes add column if not exists pedido_online_aberto boolean not null default true', alvo);

  -- ── Recebe o pedido ─────────────────────────────────────
  execute format($f$
    create or replace function %1$I.pedido_online(p_cliente jsonb, p_itens jsonb)
    returns jsonb
    language plpgsql
    security definer
    set search_path = %1$I, pg_temp
    as $fn$
    declare
      v_nome   text := left(btrim(coalesce(p_cliente->>'nome', '')), 80);
      v_tel    text := regexp_replace(coalesce(p_cliente->>'telefone', ''), '\D', '', 'g');
      v_end    text := left(btrim(coalesce(p_cliente->>'endereco', '')), 200);
      v_bairro text := nullif(left(btrim(coalesce(p_cliente->>'bairro', '')), 80), '');
      v_ref    text := nullif(left(btrim(coalesce(p_cliente->>'referencia', '')), 200), '');
      v_obs    text := nullif(left(btrim(coalesce(p_cliente->>'observacao', '')), 300), '');
      v_forma  text := coalesce(nullif(p_cliente->>'forma_pagamento', ''), 'dinheiro');
      v_troco_txt text := replace(btrim(coalesce(p_cliente->>'troco_para', '')), ',', '.');
      v_troco  numeric;
      v_taxa   numeric := 0;
      v_sub    numeric := 0;
      v_total  numeric;
      v_itens  jsonb := '[]'::jsonb;
      x        jsonb;
      p        record;
      novo     record;
    begin
      if not coalesce((select pedido_online_aberto from configuracoes limit 1), true) then
        raise exception 'A loja está fechada para pedidos no momento.';
      end if;
      if v_nome = '' then raise exception 'Coloque seu nome.'; end if;
      if length(v_tel) not between 10 and 13 then raise exception 'Coloque um WhatsApp válido, com DDD.'; end if;
      if v_end = '' then raise exception 'Coloque o endereço de entrega.'; end if;
      if v_forma not in ('dinheiro', 'pix', 'cartao') then raise exception 'Forma de pagamento inválida.'; end if;

      if jsonb_typeof(p_itens) is distinct from 'array' or jsonb_array_length(p_itens) = 0 then
        raise exception 'Seu carrinho está vazio.';
      end if;
      if jsonb_array_length(p_itens) > 50 then raise exception 'Pedido com itens demais.'; end if;
      for x in select * from jsonb_array_elements(p_itens) loop
        if coalesce(x->>'produto_id', '') !~* '^[0-9a-f-]{36}$'
           or coalesce(x->>'quantidade', '') !~ '^[0-9]{1,2}$'
           or (x->>'quantidade')::int < 1 then
          raise exception 'Quantidade inválida no pedido.';
        end if;
      end loop;

      if (select count(*) from entregas where status = 'novo' and telefone = v_tel) >= 3 then
        raise exception 'Você já tem pedidos aguardando a adega. Espere a confirmação ou chame no WhatsApp.';
      end if;

      -- Junta linhas repetidas do mesmo produto e confere tudo pelo cadastro
      for p in
        select a.pid, a.qtd, pr.nome, pr.preco, pr.ativo, pr.controla_estoque, pr.estoque_atual
        from (select (e->>'produto_id')::uuid as pid, sum((e->>'quantidade')::int) as qtd, min(ord) as ordem
              from jsonb_array_elements(p_itens) with ordinality as t(e, ord) group by 1) a
        left join produtos pr on pr.id = a.pid
        order by a.ordem   -- mantém a ordem em que o cliente montou o carrinho
      loop
        if p.nome is null or not coalesce(p.ativo, false) or coalesce(p.preco, 0) <= 0 then
          raise exception 'O produto %% não está mais disponível.', coalesce(p.nome, 'escolhido');
        end if;
        if p.qtd > 99 then raise exception 'Quantidade inválida no pedido.'; end if;
        if coalesce(p.controla_estoque, true) and coalesce(p.estoque_atual, 0) < p.qtd then
          raise exception 'Só temos %% de %% no momento.', greatest(coalesce(p.estoque_atual, 0), 0), p.nome;
        end if;
        v_itens := v_itens || jsonb_build_object(
          'produto_id', p.pid, 'nome_produto', p.nome, 'quantidade', p.qtd,
          'preco_unitario', p.preco, 'subtotal', p.preco * p.qtd);
        v_sub := v_sub + p.preco * p.qtd;
      end loop;

      if v_bairro is not null then
        select taxa into v_taxa from bairros where lower(nome) = lower(v_bairro) limit 1;
        v_taxa := coalesce(v_taxa, 0);
      end if;
      v_total := v_sub + v_taxa;

      if v_forma = 'dinheiro' and v_troco_txt <> '' then
        if v_troco_txt !~ '^[0-9]{1,6}(\.[0-9]{1,2})?$' then raise exception 'Valor do troco inválido.'; end if;
        v_troco := v_troco_txt::numeric;
        if v_troco < v_total then raise exception 'O troco precisa ser maior que o total do pedido.'; end if;
      end if;

      insert into entregas (cliente_nome, telefone, endereco, bairro, referencia, itens,
                            subtotal, taxa, total, forma_pagamento, troco_para, observacao, status, origem)
      values (v_nome, v_tel, v_end, v_bairro, v_ref, v_itens,
              v_sub, v_taxa, v_total, v_forma, v_troco, v_obs, 'novo', 'online')
      returning id, numero, total into novo;

      return jsonb_build_object('id', novo.id, 'numero', novo.numero, 'total', novo.total);
    end
    $fn$;
  $f$, alvo);

  -- ── Acompanhamento (só o pedido daquele código) ─────────
  execute format($f$
    create or replace function %1$I.status_pedido_online(p_id uuid)
    returns jsonb
    language sql
    stable
    security definer
    set search_path = %1$I, pg_temp
    as $fn$
      select jsonb_build_object(
        'numero', numero, 'status', status, 'total', total, 'created_at', created_at,
        'saiu_em', saiu_em, 'entregue_em', entregue_em, 'motivo_recusa', motivo_recusa)
      from entregas where id = p_id and origem = 'online'
    $fn$;
  $f$, alvo);

  execute format('grant execute on function %I.pedido_online(jsonb, jsonb) to anon, authenticated', alvo);
  execute format('grant execute on function %I.status_pedido_online(uuid) to anon, authenticated', alvo);
end $$;

-- Recarrega o cache da API para as funções aparecerem na hora
notify pgrst, 'reload schema';
