-- ============================================================
-- TEMPO REAL: faz as telas do sistema se atualizarem sozinhas
-- (venda feita num caixa aparece na hora no outro, pedido novo
-- aparece no Delivery etc.).
--
-- Como usar (Supabase → SQL Editor):
--   Troque 'public' abaixo pelo schema da adega e rode.
--   Rode uma vez para cada adega (public = demonstração Império).
--   Pode rodar de novo sem erro; tabelas novas entram na próxima vez.
-- ============================================================

do $$
declare
  alvo text := 'public';   -- <<< SCHEMA DA ADEGA
  t record;
  n int := 0;
begin
  for t in
    select table_name from information_schema.tables
    where table_schema = alvo and table_type = 'BASE TABLE'
      and table_name <> 'pin_tentativas'   -- interna do login (trava.sql): fica fora do tempo real
      and not exists (select 1 from pg_publication_tables p
                      where p.pubname = 'supabase_realtime' and p.schemaname = alvo and p.tablename = table_name)
  loop
    execute format('alter publication supabase_realtime add table %I.%I', alvo, t.table_name);
    n := n + 1;
  end loop;
  if exists (select 1 from pg_publication_tables
             where pubname = 'supabase_realtime' and schemaname = alvo and tablename = 'pin_tentativas') then
    execute format('alter publication supabase_realtime drop table %I.pin_tentativas', alvo);
  end if;
  raise notice 'Tempo real ligado em % tabela(s) novas do schema %', n, alvo;
end $$;
