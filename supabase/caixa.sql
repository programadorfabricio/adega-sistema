-- ============================================================
-- CAIXA: abertura, sangria/suprimento e fechamento com conferência
-- Cria as tabelas no public (demonstração) e em todas as adegas.
-- Pode rodar de novo sem erro. Adegas novas recebem pelo nova-adega.sql.
-- ============================================================

do $$
declare s text;
begin
  for s in
    select nspname from pg_namespace n
    where nspname = 'public'
       or exists (select 1 from pg_class c where c.relnamespace = n.oid and c.relname = 'produtos' and c.relkind = 'r')
  loop
    execute format($t$
      create table if not exists %I.caixas (
        id uuid primary key default gen_random_uuid(),
        status text not null default 'aberto',
        aberto_em timestamptz not null default now(),
        aberto_por text,
        troco_inicial numeric(10,2) not null default 0,
        fechado_em timestamptz,
        fechado_por text,
        esperado_dinheiro numeric(10,2),
        contado_dinheiro numeric(10,2),
        diferenca numeric(10,2),
        total_vendas numeric(10,2),
        resumo jsonb,
        observacao text
      )$t$, s);

    execute format($t$
      create table if not exists %I.caixa_movimentos (
        id uuid primary key default gen_random_uuid(),
        caixa_id uuid not null,
        tipo text not null,            -- 'sangria' (tirou) ou 'suprimento' (colocou)
        valor numeric(10,2) not null,
        motivo text,
        usuario text,
        created_at timestamptz not null default now()
      )$t$, s);

    execute format('create index if not exists caixas_status_idx on %I.caixas (status, aberto_em desc)', s);
    execute format('create index if not exists caixa_mov_idx on %I.caixa_movimentos (caixa_id, created_at)', s);

    execute format('grant all on %I.caixas, %I.caixa_movimentos to anon, authenticated, service_role', s, s);
    execute format('alter table %I.caixas enable row level security', s);
    execute format('alter table %I.caixa_movimentos enable row level security', s);
    begin execute format('create policy acesso_app on %I.caixas for all using (true) with check (true)', s);
    exception when duplicate_object then null; end;
    begin execute format('create policy acesso_app on %I.caixa_movimentos for all using (true) with check (true)', s);
    exception when duplicate_object then null; end;
    begin execute format('alter publication supabase_realtime add table %I.caixas', s);
    exception when duplicate_object then null; end;
    begin execute format('alter publication supabase_realtime add table %I.caixa_movimentos', s);
    exception when duplicate_object then null; end;
  end loop;
end $$;

-- Conferência: deve listar public e cada adega
select table_schema, table_name from information_schema.tables
where table_name in ('caixas', 'caixa_movimentos') order by 1, 2;
