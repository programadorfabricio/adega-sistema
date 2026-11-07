-- ============================================================
-- NOVA ADEGA: cria um schema próprio para um cliente, copiando a
-- estrutura do schema "public" (demo), já com TUDO que o sistema tem:
-- tabelas, permissões, tempo real, mensalidade (30 dias) e pedido online
-- (instalado, mas só aparece se ligar NEXT_PUBLIC_PEDIDO_ONLINE=1).
--
-- Passo a passo completo do cliente novo: docs/NOVO-CLIENTE.md
--
-- Como usar (Supabase → SQL Editor):
--   1. Troque 'magal' abaixo pelo nome curto do cliente (só letras minúsculas e _)
--   2. Rode o script inteiro
--   3. Em Settings → API (Data API) → "Exposed schemas", adicione o schema novo
--   4. No deploy da Vercel do cliente, defina NEXT_PUBLIC_SUPABASE_SCHEMA=<nome>
--   5. Admin inicial: Admin / PIN 1234 (troque no primeiro acesso)
-- ============================================================

do $$
declare
  novo   text := 'magal';   -- <<< NOME DO SCHEMA DO CLIENTE
  molde  text := 'public';  -- schema copiado (a demo). Não precisa mexer.
  tabelas text[] := array[
    'categorias','produtos','estoque_movimentacoes','vendas','venda_itens',
    'comandas','comanda_itens','financeiro','usuarios','configuracoes',
    'bairros','entregas',          -- delivery (rode supabase/delivery.sql uma vez antes)
    'caixas','caixa_movimentos',   -- caixa (rode supabase/caixa.sql uma vez antes)
    'produto_insumos',             -- dose fracionada (rode supabase/fracionado.sql uma vez antes)
    'fornecedores','compras','compra_itens'  -- compras (rode supabase/compras.sql uma vez antes)
  ];
  t   text;
  fk  record;
begin
  execute format('create schema if not exists %I', novo);

  -- 1. Tabelas (colunas, defaults, PKs, índices, checks)
  foreach t in array tabelas loop
    execute format('create table if not exists %I.%I (like %I.%I including all)', novo, t, molde, t);
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
    where c.contype = 'f' and n.nspname = molde and rel.relname = any(tabelas)
  loop
    begin
      execute format('alter table %I.%I add constraint %I %s',
        novo, fk.tabela, fk.conname,
        -- aponta a referência para as tabelas do schema novo
        regexp_replace(fk.def, 'REFERENCES (' || molde || '\.)?', format('REFERENCES %I.', novo)));
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

  -- 6. Mensalidade: 1 linha, vence em 30 dias. O app só lê (quem muda é você)
  if exists (select 1 from information_schema.tables where table_schema = molde and table_name = 'assinatura') then
    execute format('create table if not exists %I.assinatura (like %I.assinatura including all)', novo, molde);
    execute format('alter table %I.assinatura enable row level security', novo);
    execute format('revoke all on %I.assinatura from anon, authenticated', novo);
    execute format('grant select on %I.assinatura to anon, authenticated', novo);
    execute format('grant all on %I.assinatura to service_role', novo);
    begin
      execute format('create policy somente_leitura on %I.assinatura for select using (true)', novo);
    exception when duplicate_object then null;
    end;
    execute format('insert into %I.assinatura (vencimento) values (current_date + 30) on conflict (id) do nothing', novo);
    begin
      execute format('alter publication supabase_realtime add table %I.assinatura', novo);
    exception when duplicate_object then null;
    end;
  else
    raise notice 'Mensalidade não instalada: rode supabase/mensalidade.sql (parte 1) e depois este script de novo.';
  end if;

  -- 7. Pedido online (fica desligado até ligar NEXT_PUBLIC_PEDIDO_ONLINE=1 na Vercel)
  if to_regprocedure('public.instalar_pedido_online(text)') is not null then
    perform public.instalar_pedido_online(novo);
  else
    raise notice 'Pedido online não instalado: rode supabase/pedido-online.sql uma vez (na demo) e depois este script de novo.';
  end if;

  -- 8. Usuário admin inicial (troque o PIN no primeiro acesso)
  if not exists (select 1 from information_schema.columns where table_schema = novo and table_name = 'usuarios' and column_name = 'pin') then
    raise exception 'Tabela usuarios sem coluna pin no molde';
  end if;
  execute format($q$insert into %I.usuarios (nome, cargo, pin, ativo)
                   select 'Admin', 'admin', '1234', true
                   where not exists (select 1 from %I.usuarios where cargo = 'admin')$q$, novo, novo);

  raise notice 'Adega % criada. Falta: Exposed schemas (Data API) + projeto na Vercel. Veja docs/NOVO-CLIENTE.md', novo;
end $$;
