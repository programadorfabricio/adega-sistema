-- ============================================================
-- DESCONTO e PAGAMENTO EM MAIS DE UMA FORMA
--
-- • vendas.desconto   → quanto foi descontado na venda (R$)
-- • vendas.pagamentos → [{forma, valor}] quando pagou em 2+ formas
--                       (forma_pagamento fica "misto")
--
-- Cria no schema public e em todas as adegas. Pode rodar de novo sem erro.
-- Enquanto não rodar, o sistema continua vendendo normal (grava a forma principal).
-- ============================================================

do $$
declare s text;
begin
  for s in
    select n.nspname from pg_namespace n
    join pg_class c on c.relnamespace = n.oid and c.relname = 'vendas' and c.relkind = 'r'
  loop
    execute format('alter table %I.vendas add column if not exists desconto numeric(10,2) not null default 0', s);
    execute format('alter table %I.vendas add column if not exists pagamentos jsonb', s);
  end loop;
end $$;

notify pgrst, 'reload schema';

-- Conferência: cada adega deve aparecer com 2
select table_schema, count(*) as colunas_novas
from information_schema.columns
where table_name = 'vendas' and column_name in ('desconto', 'pagamentos')
group by table_schema order by table_schema;
