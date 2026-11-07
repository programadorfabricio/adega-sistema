-- Teste do nova-adega.sql (banco LOCAL). Usa testeadega como molde e cria "testenovo".
--   O runner troca o molde/nome e roda o script antes deste arquivo.
do $$
declare faltando text;
begin
  -- todas as tabelas do molde existem no cliente novo
  select string_agg(m.table_name, ', ') into faltando
  from information_schema.tables m
  where m.table_schema = 'testeadega' and m.table_type = 'BASE TABLE'
    and not exists (select 1 from information_schema.tables n where n.table_schema = 'testenovo' and n.table_name = m.table_name);
  assert faltando is null, 'tabelas faltando no cliente novo: ' || faltando;

  -- começa vazio (só o admin)
  assert (select count(*) from testenovo.produtos) = 0, 'produtos deveria começar vazio';
  assert (select count(*) from testenovo.usuarios where cargo = 'admin' and pin = '1234') = 1, 'admin inicial';

  -- mensalidade: 1 linha, 30 dias, só leitura pro app
  assert (select vencimento from testenovo.assinatura) = current_date + 30, 'vencimento inicial = hoje + 30';
  assert not has_table_privilege('anon', 'testenovo.assinatura', 'update'), 'cliente não pode mudar a mensalidade';
  assert has_table_privilege('anon', 'testenovo.assinatura', 'select'), 'app precisa ler a mensalidade';

  -- pedido online pronto (fica desligado pela variável da Vercel)
  assert has_function_privilege('anon', 'testenovo.pedido_online(jsonb,jsonb)', 'execute'), 'pedido_online instalado';
  assert exists (select 1 from information_schema.columns where table_schema = 'testenovo' and table_name = 'configuracoes' and column_name = 'pedido_online_aberto'), 'coluna pedido_online_aberto';
  -- instalador não pode ser chamado pelo app
  assert not has_function_privilege('anon', 'public.instalar_pedido_online(text)', 'execute'), 'instalador exposto ao anon';

  -- configuracoes gravável (botão liga/desliga e Configurações)
  assert has_table_privilege('anon', 'testenovo.configuracoes', 'update'), 'configuracoes gravável';
  assert exists (select 1 from pg_policies where schemaname = 'testenovo' and tablename = 'configuracoes' and cmd = 'ALL'), 'policy em configuracoes';

  -- tempo real em todas as tabelas
  select string_agg(t.table_name, ', ') into faltando
  from information_schema.tables t
  where t.table_schema = 'testenovo' and t.table_type = 'BASE TABLE'
    and not exists (select 1 from pg_publication_tables p where p.pubname = 'supabase_realtime' and p.schemaname = 'testenovo' and p.tablename = t.table_name);
  assert faltando is null, 'fora do tempo real: ' || faltando;

  raise notice 'OK: cliente novo criado completo';
end $$;
drop schema testenovo cascade;
