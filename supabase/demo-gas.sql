-- ============================================================
-- DEMONSTRAÇÃO: Distribuidora de gás e água (schema demogas)
-- Rode inteiro no SQL Editor. Depois, em Data API → Exposed schemas, adicione demogas.
-- ============================================================

do $$
declare
  novo   text := 'demogas';
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
insert into demogas.categorias (nome)
select c from unnest(array['gás','água','acessórios','diversos']) as c
where not exists (select 1 from demogas.categorias x where x.nome = c);

insert into demogas.produtos (nome, categoria, preco, unidade, estoque_atual, estoque_minimo, controla_estoque)
select v.* from (values
  ('Gás P13 (troca)',                  'gás',        115.00, 'un', 30, 8,  true),
  ('Gás P13 completo (com botijão)',   'gás',        320.00, 'un',  5, 2,  true),
  ('Gás P45 (troca)',                  'gás',        450.00, 'un',  4, 1,  true),
  ('Água 20 L (troca)',                'água',        14.00, 'un', 60, 15, true),
  ('Galão 20 L completo (com garrafão)','água',       45.00, 'un', 10, 3,  true),
  ('Água 1,5 L fardo c/6',             'água',        18.00, 'un', 20, 5,  true),
  ('Água 500 ml',                      'água',         2.50, 'un', 48, 12, true),
  ('Regulador de gás',                 'acessórios',  45.00, 'un',  8, 2,  true),
  ('Mangueira de gás 1,25 m',          'acessórios',  25.00, 'un', 10, 3,  true),
  ('Bomba manual para galão',          'acessórios',  25.00, 'un',  6, 2,  true),
  ('Carvão 5 kg',                      'diversos',    40.00, 'un', 10, 3,  true),
  ('Gelo 5 kg',                        'diversos',    13.00, 'un', 15, 4,  true)
) as v(nome, categoria, preco, unidade, estoque_atual, estoque_minimo, controla_estoque)
where not exists (select 1 from demogas.produtos p where p.nome = v.nome and p.ativo);

insert into demogas.bairros (nome, taxa)
select v.* from (values
  ('Centro', 5.00), ('João Aranha', 5.00), ('Morumbi', 6.00), ('Jardim Planalto', 6.00),
  ('São José', 6.00), ('Monte Alegre', 7.00), ('Nova Paulínia', 7.00), ('Betel', 8.00)
) as v(nome, taxa)
where not exists (select 1 from demogas.bairros b where b.nome = v.nome);

insert into demogas.configuracoes (nome_estabelecimento, telefone, endereco)
select 'Distribuidora FH', '(19) 98157-7861', 'Paulínia - SP'
where not exists (select 1 from demogas.configuracoes);

-- Conferência
select 'produtos' as item, count(*) from demogas.produtos
union all select 'bairros', count(*) from demogas.bairros
union all select 'usuarios', count(*) from demogas.usuarios;
