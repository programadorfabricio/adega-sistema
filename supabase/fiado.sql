-- ============================================================
-- FIADO nas comandas
--
-- • comandas.fiado      → comanda pendurada (aparece na aba "Fiado", separada das mesas)
-- • comandas.telefone   → WhatsApp do cliente, pro botão "Cobrar"
-- • comandas.valor_pago → quanto o cliente já pagou (pagamento parcial)
--
-- Cria no schema public e em todas as adegas. Pode rodar de novo sem erro.
-- Não mexe em nenhuma comanda que já existe.
-- ============================================================

do $$
declare s text;
begin
  for s in
    select n.nspname from pg_namespace n
    join pg_class c on c.relnamespace = n.oid and c.relname = 'comandas' and c.relkind = 'r'
  loop
    execute format('alter table %I.comandas add column if not exists fiado boolean not null default false', s);
    execute format('alter table %I.comandas add column if not exists telefone text', s);
    execute format('alter table %I.comandas add column if not exists valor_pago numeric(10,2) not null default 0', s);
  end loop;
end $$;

-- Conferência: deve listar public, magal, demogas, demotabacaria...
select table_schema, count(*) as colunas_novas
from information_schema.columns
where table_name = 'comandas' and column_name in ('fiado', 'telefone', 'valor_pago')
group by table_schema order by table_schema;
