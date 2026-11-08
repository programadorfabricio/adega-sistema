-- Teste do tempo-real.sql (banco LOCAL; a publicação supabase_realtime já existe no Supabase de verdade)
do $$ begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;
\i /var/tmp/pgt/sql/tempo-real-teste.sql
\i /var/tmp/pgt/sql/tempo-real-teste.sql
do $$
declare faltando text;
begin
  select string_agg(t.table_name, ', ') into faltando
  from information_schema.tables t
  where t.table_schema = 'testeadega' and t.table_type = 'BASE TABLE' and t.table_name <> 'pin_tentativas'
    and not exists (select 1 from pg_publication_tables p
                    where p.pubname = 'supabase_realtime' and p.schemaname = 'testeadega' and p.tablename = t.table_name);
  assert faltando is null, 'tabelas fora do tempo real: ' || faltando;
  -- pin_tentativas (supabase/trava.sql) fica fora: é interna e o delete do conferir_pin quebraria
  assert not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'testeadega' and tablename = 'pin_tentativas'),
    'pin_tentativas não pode estar no tempo real';
  raise notice 'OK: todas as tabelas do schema no tempo real';
end $$;
