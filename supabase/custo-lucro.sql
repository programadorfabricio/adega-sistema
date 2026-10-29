-- ============================================================
-- CUSTO e LUCRO
--
-- • produtos.preco_custo        → quanto o produto custou pra loja (por unidade / garrafa / fardo)
-- • venda_itens.custo_unitario  → custo gravado no momento da venda (o lucro do passado não muda
--                                 se o preço de compra mudar depois)
--
-- Copão/drink com receita não precisa de custo próprio: é calculado pelos insumos.
-- Cria no schema public e em todas as lojas. Pode rodar de novo sem erro.
-- Enquanto não rodar, o sistema segue funcionando sem o lucro.
-- ============================================================

do $$
declare s text;
begin
  for s in
    select n.nspname from pg_namespace n
    join pg_class c on c.relnamespace = n.oid and c.relname = 'produtos' and c.relkind = 'r'
  loop
    execute format('alter table %I.produtos add column if not exists preco_custo numeric(10,2)', s);
    if to_regclass(format('%I.venda_itens', s)) is not null then
      execute format('alter table %I.venda_itens add column if not exists custo_unitario numeric(10,4)', s);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';

-- Conferência: cada loja deve aparecer com 2
select table_schema, count(*) as colunas_novas
from information_schema.columns
where (table_name = 'produtos' and column_name = 'preco_custo')
   or (table_name = 'venda_itens' and column_name = 'custo_unitario')
group by table_schema order by table_schema;
