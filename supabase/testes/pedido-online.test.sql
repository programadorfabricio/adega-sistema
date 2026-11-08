-- Teste das funções de pedido online (rodar no banco LOCAL de teste, schema testeadega).
-- Tudo roda dentro de uma transação desfeita no final: não deixa sujeira.
--   psql -h /tmp -p 5499 -U postgres -d postgres -v ON_ERROR_STOP=1 -f pedido-online.test.sql
begin;

set local search_path = testeadega, public;

do $$
declare
  cerveja uuid;
  copao   uuid;
  inativo uuid;
  semest  uuid;
  c       jsonb;
  it      jsonb;
  r       jsonb;
  e       record;
  msg     text;
  cli     jsonb := '{"nome":"Ana","telefone":"(19) 99999-0000","endereco":"Rua A, 10","bairro":"Centro","forma_pagamento":"pix"}';
begin
  delete from entregas;
  delete from bairros;
  insert into bairros (nome, taxa) values ('Centro', 7);
  insert into produtos (nome, categoria, preco, unidade, estoque_atual, estoque_minimo, controla_estoque, ativo)
    values ('Cerveja Teste', 'cerveja', 10, 'un', 5, 0, true, true) returning id into cerveja;
  insert into produtos (nome, categoria, preco, unidade, estoque_atual, estoque_minimo, controla_estoque, ativo)
    values ('Copão Teste', 'copão', 30, 'un', 0, 0, false, true) returning id into copao;
  insert into produtos (nome, categoria, preco, unidade, estoque_atual, estoque_minimo, controla_estoque, ativo)
    values ('Inativo Teste', 'cerveja', 8, 'un', 10, 0, true, false) returning id into inativo;
  insert into produtos (nome, categoria, preco, unidade, estoque_atual, estoque_minimo, controla_estoque, ativo)
    values ('Sem Estoque Teste', 'cerveja', 9, 'un', 0, 0, true, true) returning id into semest;

  -- 1. preço vem do cadastro, não do celular; taxa do bairro; telefone só dígitos
  r := pedido_online(cli, jsonb_build_array(
         jsonb_build_object('produto_id', cerveja, 'quantidade', 2, 'preco_unitario', 0.01),
         jsonb_build_object('produto_id', copao, 'quantidade', 1)));
  select * into e from entregas where id = (r->>'id')::uuid;
  assert e.subtotal = 50, format('subtotal esperado 50, veio %s', e.subtotal);
  assert e.taxa = 7, format('taxa esperada 7, veio %s', e.taxa);
  assert e.total = 57 and (r->>'total')::numeric = 57, 'total esperado 57';
  assert e.status = 'novo' and e.origem = 'online', 'status/origem errados';
  assert e.telefone = '19999990000', format('telefone não normalizado: %s', e.telefone);
  assert (e.itens->0->>'preco_unitario')::numeric = 10, 'preço unitário do item deveria ser 10';
  assert (e.itens->0->>'nome_produto') = 'Cerveja Teste', 'nome do item deveria vir do cadastro';
  assert (r->>'numero') is not null, 'deveria devolver o número';
  -- pedido online não mexe no estoque (só no aceite)
  assert (select estoque_atual from produtos where id = cerveja) = 5, 'estoque não deveria mudar no pedido';

  -- 2. bairro inexistente → taxa 0
  r := pedido_online(cli || '{"bairro":"Lugar Nenhum","telefone":"11 98888-1111"}', jsonb_build_array(jsonb_build_object('produto_id', copao, 'quantidade', 1)));
  assert (select taxa from entregas where id = (r->>'id')::uuid) = 0, 'bairro desconhecido deveria ter taxa 0';

  -- 3. estoque insuficiente → erro com o nome do produto
  begin
    perform pedido_online(cli || '{"telefone":"11 97777-0000"}', jsonb_build_array(jsonb_build_object('produto_id', cerveja, 'quantidade', 6)));
    raise exception 'FALHOU: aceitou quantidade maior que o estoque';
  exception when others then
    get stacked diagnostics msg = message_text;
    assert msg like '%Cerveja Teste%', format('mensagem deveria citar o produto: %s', msg);
  end;

  -- 4. produto inativo → erro
  begin
    perform pedido_online(cli || '{"telefone":"11 97777-0001"}', jsonb_build_array(jsonb_build_object('produto_id', inativo, 'quantidade', 1)));
    raise exception 'FALHOU: aceitou produto inativo';
  exception when others then
    get stacked diagnostics msg = message_text;
    assert msg not like 'FALHOU%', msg;
  end;

  -- 5. quantidade inválida e carrinho vazio → erro
  begin
    perform pedido_online(cli || '{"telefone":"11 97777-0002"}', jsonb_build_array(jsonb_build_object('produto_id', copao, 'quantidade', 0)));
    raise exception 'FALHOU: aceitou quantidade 0';
  exception when others then
    get stacked diagnostics msg = message_text; assert msg not like 'FALHOU%', msg;
  end;
  begin
    perform pedido_online(cli || '{"telefone":"11 97777-0003"}', '[]'::jsonb);
    raise exception 'FALHOU: aceitou carrinho vazio';
  exception when others then
    get stacked diagnostics msg = message_text; assert msg not like 'FALHOU%', msg;
  end;

  -- 6. sem nome/endereço → erro
  begin
    perform pedido_online('{"nome":" ","telefone":"11977770004","endereco":"Rua B"}', jsonb_build_array(jsonb_build_object('produto_id', copao, 'quantidade', 1)));
    raise exception 'FALHOU: aceitou sem nome';
  exception when others then
    get stacked diagnostics msg = message_text; assert msg not like 'FALHOU%', msg;
  end;

  -- 7. máximo de 3 pedidos "novo" por telefone (máscara diferente conta igual)
  perform pedido_online(cli || '{"telefone":"19 99999 0000"}', jsonb_build_array(jsonb_build_object('produto_id', copao, 'quantidade', 1)));
  perform pedido_online(cli || '{"telefone":"19999990000"}', jsonb_build_array(jsonb_build_object('produto_id', copao, 'quantidade', 1)));
  begin
    perform pedido_online(cli, jsonb_build_array(jsonb_build_object('produto_id', copao, 'quantidade', 1)));
    raise exception 'FALHOU: aceitou o 4º pedido pendente';
  exception when others then
    get stacked diagnostics msg = message_text; assert msg not like 'FALHOU%', msg;
  end;

  -- 8. loja fechada → erro "fechad"
  update configuracoes set pedido_online_aberto = false;
  begin
    perform pedido_online(cli || '{"telefone":"11 96666-0000"}', jsonb_build_array(jsonb_build_object('produto_id', copao, 'quantidade', 1)));
    raise exception 'FALHOU: aceitou com a loja fechada';
  exception when others then
    get stacked diagnostics msg = message_text;
    assert msg ilike '%fechad%', format('mensagem deveria dizer fechado: %s', msg);
  end;
  update configuracoes set pedido_online_aberto = true;

  -- 9. acompanhamento
  r := status_pedido_online((select id from entregas order by created_at limit 1));
  assert r->>'status' = 'novo', format('status esperado novo: %s', r);
  assert status_pedido_online(gen_random_uuid()) is null, 'uuid desconhecido deveria devolver null';

  -- 10. anon pode executar
  assert has_function_privilege('anon', 'testeadega.pedido_online(jsonb,jsonb)', 'execute'), 'anon sem execute';
  assert has_function_privilege('anon', 'testeadega.status_pedido_online(uuid)', 'execute'), 'anon sem execute (status)';

  -- 11. security definer com search_path seguro (schema da adega + pg_temp por último, sem public)
  assert (select array_to_string(proconfig, ',') from pg_proc where oid = 'testeadega.pedido_online(jsonb,jsonb)'::regprocedure)
         = 'search_path=testeadega, pg_temp', 'search_path inseguro em pedido_online';
  assert (select array_to_string(proconfig, ',') from pg_proc where oid = 'testeadega.status_pedido_online(uuid)'::regprocedure)
         = 'search_path=testeadega, pg_temp', 'search_path inseguro em status_pedido_online';

  -- 12. cardapio_online: só o que o cliente pode ver, nunca o custo
  c := cardapio_online();
  assert jsonb_typeof(c->'produtos') = 'array' and jsonb_typeof(c->'bairros') = 'array', 'cardapio: produtos/bairros deveriam ser arrays';
  assert exists (select 1 from jsonb_array_elements(c->'produtos') x where x->>'id' = cerveja::text), 'cardapio: produto ativo deveria aparecer';
  assert exists (select 1 from jsonb_array_elements(c->'produtos') x where x->>'id' = copao::text), 'cardapio: copão sem controle deveria aparecer';
  assert not exists (select 1 from jsonb_array_elements(c->'produtos') x where x->>'id' = inativo::text), 'cardapio: inativo não deveria aparecer';
  assert not exists (select 1 from jsonb_array_elements(c->'produtos') x where x->>'id' = semest::text), 'cardapio: controlado com estoque 0 não deveria aparecer';
  for it in select * from jsonb_array_elements(c->'produtos') loop
    assert not (it ? 'preco_custo'), 'cardapio: expôs preco_custo';
    assert (select array_agg(k order by k) from jsonb_object_keys(it) k)
           = array['categoria','controla_estoque','estoque_atual','id','nome','preco'], format('cardapio: chaves inesperadas %s', it);
  end loop;
  assert c->'bairros' = '[{"nome":"Centro","taxa":7}]'::jsonb, format('cardapio: bairros inesperados %s', c->'bairros');
  assert (c->'loja'->>'aberto')::boolean is true, 'cardapio: loja deveria estar aberta';
  assert (select array_agg(k order by k) from jsonb_object_keys(c->'loja') k) = array['aberto','nome','telefone'], 'cardapio: chaves da loja';
  update configuracoes set pedido_online_aberto = false;
  assert ((cardapio_online())->'loja'->>'aberto')::boolean is false, 'cardapio: loja deveria estar fechada';
  update configuracoes set pedido_online_aberto = true;
  delete from bairros;
  assert (cardapio_online())->'bairros' = '[]'::jsonb, 'cardapio: sem bairros deveria ser []';
  assert has_function_privilege('anon', 'testeadega.cardapio_online()', 'execute'), 'anon sem execute (cardapio)';
  assert (select array_to_string(proconfig, ',') from pg_proc where oid = 'testeadega.cardapio_online()'::regprocedure)
         = 'search_path=testeadega, pg_temp', 'search_path inseguro em cardapio_online';

  raise notice 'OK: todos os testes de pedido online passaram';
end $$;

rollback;
