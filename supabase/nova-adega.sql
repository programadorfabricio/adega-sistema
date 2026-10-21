-- ============================================================
-- NOVA ADEGA: cria um schema próprio para um cliente,
-- copiando a estrutura das tabelas do schema "public".
--
-- Como usar (Supabase → SQL Editor):
--   1. Troque 'magal' abaixo pelo nome curto do cliente (só letras minúsculas e _)
--   2. Rode o script inteiro
--   3. Em Settings → API (Data API) → "Exposed schemas", adicione o schema novo
--   4. No deploy da Vercel do cliente, defina NEXT_PUBLIC_SUPABASE_SCHEMA=<nome>
--   5. No final do script há o usuário admin inicial — troque nome e PIN
-- ============================================================

do $$
declare
  novo   text := 'magal';   -- <<< NOME DO SCHEMA DO CLIENTE
  tabelas text[] := array[
    'categorias','produtos','estoque_movimentacoes','vendas','venda_itens',
    'comandas','comanda_itens','financeiro','usuarios','configuracoes',
    'bairros','entregas'   -- delivery (rode supabase/delivery.sql uma vez antes)
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

  -- 6. Usuário admin inicial  <<< TROQUE NOME E PIN
  execute format($q$insert into %I.usuarios (nome, cargo, pin, ativo) values ('Magal', 'admin', '1234', true)$q$, novo);
end $$;
