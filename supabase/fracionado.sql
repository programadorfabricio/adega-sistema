-- ============================================================
-- DOSE FRACIONADA: copão/drink que desconta a dose da garrafa
--
-- • produtos.volume_ml  → volume da garrafa (ex.: 1000). Só pra quem vende em dose.
-- • produtos.ml_aberto  → o que sobra na garrafa/fardo aberto (o sistema controla sozinho)
-- • produtos.fracao_unidade → 'ml' (garrafa em dose) ou 'un' (fardo vendido em latas)
-- • produto_insumos     → receita: "Copão Red Label usa 100 ml de Red Label + 1 Red Bull"
--
-- Cria no schema public e em todas as adegas. Pode rodar de novo sem erro.
-- Não mexe em nenhum produto, venda ou estoque que já existe.
-- ============================================================

do $$
declare
  s text;
  tipo_id text;
begin
  for s in
    select nspname from pg_namespace n
    where nspname = 'public'
       or exists (select 1 from pg_class c where c.relnamespace = n.oid and c.relname = 'produtos' and c.relkind = 'r')
  loop
    -- só schemas que têm a tabela produtos
    continue when to_regclass(format('%I.produtos', s)) is null;

    execute format('alter table %I.produtos add column if not exists volume_ml integer', s);
    execute format('alter table %I.produtos add column if not exists ml_aberto numeric(10,2) not null default 0', s);
    execute format($c$alter table %I.produtos add column if not exists fracao_unidade text not null default 'ml'$c$, s);

    -- mesmo tipo do id de produtos (uuid ou número)
    select format_type(a.atttypid, a.atttypmod) into tipo_id
    from pg_attribute a where a.attrelid = format('%I.produtos', s)::regclass and a.attname = 'id';

    execute format($t$
      create table if not exists %I.produto_insumos (
        id uuid primary key default gen_random_uuid(),
        produto_id %s not null references %I.produtos(id) on delete cascade,
        insumo_id  %s not null references %I.produtos(id) on delete cascade,
        quantidade numeric(10,2) not null check (quantidade > 0),
        created_at timestamptz not null default now(),
        unique (produto_id, insumo_id)
      )$t$, s, tipo_id, s, tipo_id, s);

    execute format('grant all on %I.produto_insumos to anon, authenticated, service_role', s);
    execute format('alter table %I.produto_insumos enable row level security', s);
    begin
      execute format('create policy acesso_app on %I.produto_insumos for all using (true) with check (true)', s);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- Conferência: deve listar public, magal, demogas, demotabacaria...
select table_schema, count(*) as tabelas
from information_schema.tables
where table_name = 'produto_insumos'
group by table_schema order by table_schema;
