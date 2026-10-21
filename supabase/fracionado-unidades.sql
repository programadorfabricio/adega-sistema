-- Fardo vendido em latas: adiciona a unidade da fração (ml ou un) em todas as adegas.
-- Pode rodar de novo sem erro.
do $$
declare s text;
begin
  for s in select n.nspname from pg_namespace n where exists (select 1 from pg_class c where c.relnamespace = n.oid and c.relname = 'produtos' and c.relkind = 'r') loop
    execute format($c$alter table %I.produtos add column if not exists fracao_unidade text not null default 'ml'$c$, s);
  end loop;
end $$;

select table_schema, count(*) from information_schema.columns where column_name = 'fracao_unidade' group by 1 order by 1;
