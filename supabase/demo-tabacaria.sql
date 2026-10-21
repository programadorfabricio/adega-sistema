-- ============================================================
-- DEMONSTRAÇÃO: Tabacaria (schema demotabacaria)
-- Rode inteiro no SQL Editor. Depois, em Data API → Exposed schemas, adicione demotabacaria.
-- ============================================================

do $$
declare
  novo   text := 'demotabacaria';
  tabelas text[] := array[
    'categorias','produtos','estoque_movimentacoes','vendas','venda_itens',
    'comandas','comanda_itens','financeiro','usuarios','configuracoes',
    'bairros','entregas',          -- delivery (rode supabase/delivery.sql uma vez antes)
    'caixas','caixa_movimentos',   -- caixa (rode supabase/caixa.sql uma vez antes)
    'produto_insumos'              -- dose fracionada (rode supabase/fracionado.sql uma vez antes)
  ];
  t   text;
  fk  record;
begin
  execute format('create schema if not exists %I', novo);

  -- 1. Tabelas (colunas, defaults, PKs, índices, checks)
  foreach t in array tabelas loop
    execute format('create table if not exists %I.%I (like public.%I including all)', novo, t, t);
  end loop;

  -- Categorias vêm da tabela de categorias (Configurações), não de uma lista fixa
  execute format('alter table %I.produtos drop constraint if exists produtos_categoria_check', novo);

  -- 2. Chaves estrangeiras (necessárias para os selects com join, ex: comanda_itens(*, produtos(...)))
  for fk in
    select c.conname, rel.relname as tabela,
           pg_get_constraintdef(c.oid) as def
    from pg_constraint c
    join pg_class rel on rel.oid = c.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
    where c.contype = 'f' and n.nspname = 'public' and rel.relname = any(tabelas)
  loop
    begin
      execute format('alter table %I.%I add constraint %I %s',
        novo, fk.tabela, fk.conname,
        -- aponta a referência para as tabelas do schema novo
        regexp_replace(fk.def, 'REFERENCES (public\.)?', format('REFERENCES %I.', novo)));
    exception when duplicate_object then null;
    end;
  end loop;

  -- 3. Permissões (mesmo nível de acesso que o schema public tem hoje)
  execute format('grant usage on schema %I to anon, authenticated, service_role', novo);
  execute format('grant all on all tables in schema %I to anon, authenticated, service_role', novo);
  execute format('grant all on all sequences in schema %I to anon, authenticated, service_role', novo);
  execute format('alter default privileges in schema %I grant all on tables to anon, authenticated, service_role', novo);

  -- 4. RLS com acesso liberado (o sistema faz login por PIN no próprio app)
  foreach t in array tabelas loop
    execute format('alter table %I.%I enable row level security', novo, t);
    begin
      execute format('create policy acesso_app on %I.%I for all using (true) with check (true)', novo, t);
    exception when duplicate_object then null;
    end;
  end loop;

  -- 5. Tempo real (atualização automática das telas)
  foreach t in array tabelas loop
    begin
      execute format('alter publication supabase_realtime add table %I.%I', novo, t);
    exception when duplicate_object then null;
    end;
  end loop;

  -- 6. Usuário da demonstração (PIN 1234)
  execute format($q$insert into %I.usuarios (nome, cargo, pin, ativo) select 'Demonstração', 'admin', '1234', true where not exists (select 1 from %I.usuarios)$q$, novo, novo);
end $$;

-- ============================================================
-- Dados da demonstração: produtos, bairros e nome
-- ============================================================
insert into demotabacaria.categorias (nome)
select c from unnest(array['essências','carvão','acessórios','narguilés','combos','diversos']) as c
where not exists (select 1 from demotabacaria.categorias x where x.nome = c);

insert into demotabacaria.produtos (nome, categoria, preco, unidade, estoque_atual, estoque_minimo, controla_estoque)
select v.* from (values
  ('Essência 50 g · Menta',             'essências',   28.00, 'un', 14, 4, true),
  ('Essência 50 g · Uva',               'essências',   28.00, 'un',  2, 4, true),
  ('Essência 50 g · Melancia',          'essências',   28.00, 'un', 10, 4, true),
  ('Essência 50 g · Pêssego',           'essências',   28.00, 'un',  8, 4, true),
  ('Essência 50 g · Limão com menta',   'essências',   28.00, 'un', 12, 4, true),
  ('Essência 250 g · Menta',            'essências',  110.00, 'un',  3, 1, true),
  ('Carvão de coco 1 kg',               'carvão',      32.00, 'un', 24, 6, true),
  ('Carvão de coco 500 g',              'carvão',      18.00, 'un', 20, 6, true),
  ('Rosh de cerâmica',                  'acessórios',  35.00, 'un',  9, 3, true),
  ('Mangueira de silicone',             'acessórios',  30.00, 'un', 11, 3, true),
  ('Papel alumínio p/ rosh',            'acessórios',   9.00, 'un', 30, 8, true),
  ('Pegador de carvão',                 'acessórios',  15.00, 'un',  7, 2, true),
  ('Isqueiro',                          'diversos',     6.00, 'un', 40, 10, true),
  ('Seda',                              'diversos',     5.00, 'un', 50, 12, true),
  ('Narguilé médio completo',           'narguilés',  220.00, 'un',  4, 1, true),
  ('Combo: narguilé + essência + carvão','combos',     260.00, 'un',  0, 0, false)
) as v(nome, categoria, preco, unidade, estoque_atual, estoque_minimo, controla_estoque)
where not exists (select 1 from demotabacaria.produtos p where p.nome = v.nome and p.ativo);

insert into demotabacaria.bairros (nome, taxa)
select v.* from (values
  ('Centro', 5.00), ('João Aranha', 5.00), ('Morumbi', 6.00), ('Jardim Planalto', 6.00),
  ('São José', 6.00), ('Monte Alegre', 7.00), ('Nova Paulínia', 7.00), ('Betel', 8.00)
) as v(nome, taxa)
where not exists (select 1 from demotabacaria.bairros b where b.nome = v.nome);

insert into demotabacaria.configuracoes (nome_estabelecimento, telefone, endereco)
select 'Tabacaria FH', '(19) 98157-7861', 'Paulínia - SP'
where not exists (select 1 from demotabacaria.configuracoes);

-- Conferência
select 'produtos' as item, count(*) from demotabacaria.produtos
union all select 'bairros', count(*) from demotabacaria.bairros
union all select 'usuarios', count(*) from demotabacaria.usuarios;
