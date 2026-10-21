-- ============================================================
-- MENSALIDADE: aviso de vencimento e bloqueio por falta de pagamento
--
-- 1 linha por adega. O sistema só LÊ esta tabela; quem altera é você,
-- pelo Supabase (SQL Editor ou Table Editor). O cliente não consegue mudar.
--
-- Como funciona no sistema:
--   • faltando "dias_aviso" dias ou menos → faixa amarela no topo (dá pra fechar)
--   • venceu → faixa vermelha (não fecha) dizendo até quando pagar
--   • passou "dias_tolerancia" dias do vencimento → tela de "Sistema suspenso"
--     (só se bloquear = true)
-- ============================================================

-- 1. Cria a tabela no public (molde) e em todas as adegas
do $$
declare s text;
begin
  for s in
    select nspname from pg_namespace n
    where nspname = 'public'
       or exists (select 1 from pg_class c where c.relnamespace = n.oid and c.relname = 'produtos' and c.relkind = 'r')
  loop
    execute format($t$
      create table if not exists %I.assinatura (
        id int primary key default 1 check (id = 1),
        vencimento date not null,
        valor numeric(10,2) not null default 129,
        pix text,
        whatsapp text default '5519981577861',
        dias_aviso int not null default 5,
        dias_tolerancia int not null default 5,
        bloquear boolean not null default true,
        updated_at timestamptz not null default now()
      )$t$, s);
    execute format('alter table %I.assinatura enable row level security', s);
    execute format('revoke all on %I.assinatura from anon, authenticated', s);
    execute format('grant select on %I.assinatura to anon, authenticated', s);
    execute format('grant all on %I.assinatura to service_role', s);
    begin
      execute format('create policy somente_leitura on %I.assinatura for select using (true)', s);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- 2. Mensalidade da Adega do Magal  <<< troque a chave Pix e a data
insert into magal.assinatura (vencimento, valor, pix)
values ('2026-10-27', 129.00, 'SUA_CHAVE_PIX')
on conflict (id) do update
  set vencimento = excluded.vencimento, valor = excluded.valor, pix = excluded.pix, updated_at = now();

select * from magal.assinatura;


-- ============================================================
-- USO NO DIA A DIA (rode só a linha que precisar)
-- ============================================================

-- Cliente pagou → empurra o vencimento 1 mês:
--   update magal.assinatura set vencimento = vencimento + interval '1 month', updated_at = now();

-- Liberar na hora quem está bloqueado (ex.: pagou no fim de semana):
--   update magal.assinatura set vencimento = current_date + 30, updated_at = now();

-- Nunca bloquear este cliente (só avisar):
--   update magal.assinatura set bloquear = false;

-- Ver como está cada adega:
--   select 'magal' as adega, vencimento, vencimento - current_date as dias from magal.assinatura;
