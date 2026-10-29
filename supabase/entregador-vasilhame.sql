-- ============================================================
-- ENTREGADOR e VASILHAME nas entregas (gás e água)
--
-- • entregas.entregador         → quem levou o pedido (acerto do dia por entregador)
-- • entregas.vazio_pendente     → quantos vasilhames vazios ficaram com o cliente
-- • entregas.vazio_recolhido_em → quando o vazio foi recolhido
--
-- Cria em todas as lojas que têm entregas. Pode rodar de novo sem erro.
-- Enquanto não rodar, o delivery continua funcionando como antes.
-- ============================================================

do $$
declare s text;
begin
  for s in
    select n.nspname from pg_namespace n
    join pg_class c on c.relnamespace = n.oid and c.relname = 'entregas' and c.relkind = 'r'
  loop
    execute format('alter table %I.entregas add column if not exists entregador text', s);
    execute format('alter table %I.entregas add column if not exists vazio_pendente integer not null default 0', s);
    execute format('alter table %I.entregas add column if not exists vazio_recolhido_em timestamptz', s);
    execute format('create index if not exists entregas_vazio_idx on %I.entregas (vazio_pendente) where vazio_pendente > 0 and vazio_recolhido_em is null', s);
  end loop;
end $$;

notify pgrst, 'reload schema';

-- Conferência: cada loja deve aparecer com 3
select table_schema, count(*) as colunas_novas
from information_schema.columns
where table_name = 'entregas' and column_name in ('entregador', 'vazio_pendente', 'vazio_recolhido_em')
group by table_schema order by table_schema;
