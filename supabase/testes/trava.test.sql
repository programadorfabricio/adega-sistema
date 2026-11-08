-- Teste da trava do banco (supabase/trava.sql) no banco LOCAL de teste (schema testeadega).
-- Tudo roda dentro de uma transação desfeita no final: testeadega continua DESTRANCADA depois.
--   Rodar: scripts/testar-trava.sh (instala as funções do trava.sql sem o bloco final e roda este arquivo).
begin;

-- ── Stub do auth.jwt() (só no banco local; no Supabase já existe) ──────────
create schema if not exists auth;
do $$
begin
  if to_regprocedure('auth.jwt()') is null then
    execute $f$create function auth.jwt() returns jsonb language sql stable as $b$
      select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $b$ $f$;
  end if;
end $$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.jwt() to anon, authenticated;

-- Chama conferir_pin com o id em texto (o tipo do id de usuarios varia: integer local, uuid no Supabase)
create function public.t_pin(s text, u text, p text) returns jsonb language plpgsql as $$
declare r jsonb;
begin
  execute format('select %I.conferir_pin(%L, %L)', s, u, p) into r;
  return r;
end $$;
grant execute on function public.t_pin(text, text, text) to anon, authenticated;

-- ── Segunda adega (pra provar que uma não enxerga a outra) ─────────────────
create schema testeoutra;
create table testeoutra.produtos (like testeadega.produtos including all);
create table testeoutra.vendas   (like testeadega.vendas including all);
create table testeoutra.usuarios (like testeadega.usuarios including all);
insert into testeoutra.produtos (nome, preco) values ('Produto da Outra', 5);
insert into testeoutra.usuarios (nome, cargo, pin, ativo) values ('Dono Outra', 'admin', '9999', true);
-- mesmo estado de hoje (acesso liberado)
grant usage on schema testeoutra to anon, authenticated;
grant all on all tables in schema testeoutra to anon, authenticated;
alter table testeoutra.produtos enable row level security;
alter table testeoutra.vendas   enable row level security;
alter table testeoutra.usuarios enable row level security;
create policy acesso_app on testeoutra.produtos for all using (true) with check (true);
create policy acesso_app on testeoutra.vendas   for all using (true) with check (true);
create policy acesso_app on testeoutra.usuarios for all using (true) with check (true);

-- Usuário inativo na adega de teste + ids guardados pra usar com outros papéis
insert into testeadega.usuarios (nome, cargo, pin, ativo) values ('Inativo Teste', 'caixa', '5555', false);
select set_config('t.admin',   (select id::text from testeadega.usuarios where nome = 'Teste'), true);
select set_config('t.inativo', (select id::text from testeadega.usuarios where nome = 'Inativo Teste'), true);
select set_config('t.aleatorio',
  (select case when data_type = 'uuid' then gen_random_uuid()::text else '987654321' end
   from information_schema.columns where table_schema = 'testeadega' and table_name = 'usuarios' and column_name = 'id'), true);
update testeadega.usuarios set pin = '1234' where nome = 'Teste';

-- ── Instala (2× = pode rodar de novo sem erro) ─────────────────────────────
select public.instalar_trava('testeadega');
select public.instalar_trava('testeadega');
select public.instalar_trava('testeoutra');

do $$
declare recusou boolean;
begin
  -- a demo (public) nunca é trancada; schema inexistente é recusado
  recusou := false;
  begin perform public.instalar_trava('public'); exception when others then recusou := true; end;
  assert recusou, 'instalar_trava(public) deveria ser recusado';
  recusou := false;
  begin perform public.instalar_trava('nao_existe_xyz'); exception when others then recusou := true; end;
  assert recusou, 'instalar_trava(schema inexistente) deveria ser recusado';

  -- funções: quem pode chamar
  assert not has_function_privilege('anon', 'public.instalar_trava(text)', 'execute'), 'instalador exposto ao anon';
  assert not has_function_privilege('authenticated', 'public.instalar_trava(text)', 'execute'), 'instalador exposto ao authenticated';
  assert not has_function_privilege('anon', 'public.destrancar(text)', 'execute'), 'destrancar exposto ao anon';
  assert not has_function_privilege('authenticated', 'public.destrancar(text)', 'execute'), 'destrancar exposto ao authenticated';
  assert has_function_privilege('anon', 'public.ping()', 'execute'), 'ping precisa ser do anon';
  assert has_function_privilege('authenticated', 'public.schema_da_loja()', 'execute'), 'schema_da_loja pro authenticated';
  assert not has_function_privilege('anon', (select p.oid from pg_proc p where p.pronamespace = 'testeadega'::regnamespace and p.proname = 'conferir_pin'), 'execute'), 'conferir_pin exposto ao anon';
  assert has_function_privilege('authenticated', (select p.oid from pg_proc p where p.pronamespace = 'testeadega'::regnamespace and p.proname = 'conferir_pin'), 'execute'), 'conferir_pin pro authenticated';

  -- pin_tentativas: ninguém do app mexe
  assert not has_table_privilege('anon', 'testeadega.pin_tentativas', 'select,insert,update,delete'), 'pin_tentativas exposta ao anon';
  assert not has_table_privilege('authenticated', 'testeadega.pin_tentativas', 'select,insert,update,delete'), 'pin_tentativas exposta ao authenticated';

  -- TRUNCATE ignora RLS: a conta da loja não pode ter
  assert not has_table_privilege('authenticated', 'testeadega.vendas', 'truncate'), 'authenticated com truncate';
  assert not has_sequence_privilege('anon', 'testeadega.usuarios_id_seq', 'usage'), 'anon com sequence';

  -- policies: loja_<tabela> em toda tabela base menos assinatura e pin_tentativas; nenhuma acesso_app
  assert not exists (
    select 1 from information_schema.tables t
    where t.table_schema = 'testeadega' and t.table_type = 'BASE TABLE'
      and t.table_name not in ('assinatura', 'pin_tentativas')
      and not exists (select 1 from pg_policies p where p.schemaname = 'testeadega' and p.tablename = t.table_name and p.policyname = 'loja_' || t.table_name)
  ), 'faltou policy loja_<tabela>';
  assert not exists (select 1 from pg_policies where schemaname = 'testeadega' and policyname in ('acesso_app', 'acesso_app_config')), 'sobrou acesso_app';
  assert not exists (select 1 from pg_class where relnamespace = 'testeadega'::regnamespace and relkind = 'r' and not relrowsecurity), 'tabela sem RLS';
  assert exists (select 1 from pg_policies where schemaname = 'testeadega' and tablename = 'assinatura' and policyname = 'somente_leitura'), 'assinatura mantém a policy dela';
end $$;

-- ── anon (sem login da loja) ───────────────────────────────────────────────
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
declare negou boolean; t text; r jsonb;
begin
  foreach t in array array['produtos', 'vendas', 'usuarios', 'configuracoes', 'financeiro'] loop
    negou := false;
    begin execute format('select count(*) from testeadega.%I', t); exception when insufficient_privilege then negou := true; end;
    assert negou, format('anon leu testeadega.%s', t);
  end loop;
  negou := false;
  begin insert into testeadega.vendas (total) values (1); exception when insufficient_privilege then negou := true; end;
  assert negou, 'anon inseriu venda';
  negou := false;
  begin perform public.t_pin('testeadega', current_setting('t.admin'), '1234'); exception when insufficient_privilege then negou := true; end;
  assert negou, 'anon chamou conferir_pin';

  -- o que o anon ainda usa: cardápio, acompanhamento, ping
  r := testeadega.cardapio_online();
  assert jsonb_array_length(r->'produtos') > 0, 'cardapio_online sem produtos pro anon';
  assert testeadega.status_pedido_online(gen_random_uuid()) is null, 'status_pedido_online';
  assert public.ping(), 'ping';
  assert public.schema_da_loja() is null, 'anon não tem schema';
end $$;
reset role;

-- ── conta da OUTRA adega tentando a testeadega ─────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","app_metadata":{"schema":"testeoutra"}}', true);
do $$
declare negou boolean; n int; r jsonb;
begin
  assert public.schema_da_loja() = 'testeoutra', 'schema_da_loja';
  assert (select count(*) from testeadega.produtos) = 0, 'outra adega enxergou produtos';
  assert (select count(*) from testeadega.vendas) = 0, 'outra adega enxergou vendas';
  assert (select count(*) from (select id, nome from testeadega.usuarios) x) = 0, 'outra adega enxergou usuarios';
  negou := false;
  begin insert into testeadega.vendas (total) values (1); exception when insufficient_privilege then negou := true; end;
  assert negou, 'outra adega inseriu venda';
  update testeadega.produtos set preco = 0;
  get diagnostics n = row_count;
  assert n = 0, 'outra adega alterou produtos';
  delete from testeadega.produtos;
  get diagnostics n = row_count;
  assert n = 0, 'outra adega apagou produtos';
  r := public.t_pin('testeadega', current_setting('t.admin'), '1234');
  assert (r->>'ok')::boolean = false, 'conferir_pin aceitou conta de outra adega: ' || r::text;
  -- a própria adega funciona
  assert (select count(*) from testeoutra.produtos) = 1, 'testeoutra não lê os próprios produtos';
  insert into testeoutra.vendas (total) values (3);
end $$;
reset role;

-- ── conta da testeadega ────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","app_metadata":{"schema":"testeadega"}}', true);
do $$
declare negou boolean; n int; v uuid; r jsonb; i int;
begin
  assert (select count(*) from testeadega.produtos) > 0, 'loja não lê os próprios produtos';
  insert into testeadega.vendas (total, forma_pagamento, status) values (12, 'pix', 'concluida') returning id into v;
  delete from testeadega.vendas where id = v;
  get diagnostics n = row_count;
  assert n = 1, 'loja não apagou a própria venda';
  assert (select count(*) from testeoutra.produtos) = 0, 'testeadega enxergou produtos da outra';

  -- PIN escondido
  negou := false;
  begin perform pin from testeadega.usuarios; exception when insufficient_privilege then negou := true; end;
  assert negou, 'loja leu a coluna pin';
  negou := false;
  begin perform * from testeadega.usuarios; exception when insufficient_privilege then negou := true; end;
  assert negou, 'select * em usuarios deveria falhar';
  assert (select count(*) from (select id, nome, cargo, ativo from testeadega.usuarios) x) >= 2, 'loja não lê id/nome de usuarios';
  execute format('update testeadega.usuarios set pin = %L where id = %L', '4321', current_setting('t.admin'));
  get diagnostics n = row_count;
  assert n = 1, 'loja não trocou o PIN';
  execute format('update testeadega.usuarios set pin = %L where id = %L', '1234', current_setting('t.admin'));

  -- conferir_pin
  r := public.t_pin('testeadega', current_setting('t.admin'), '1234');
  assert (r->>'ok')::boolean and r->'usuario'->>'nome' = 'Teste' and r->'usuario'->>'cargo' = 'admin'
         and r->'usuario'->>'id' = current_setting('t.admin'), 'PIN certo: ' || r::text;
  assert not (r->'usuario') ? 'pin', 'conferir_pin devolveu o pin';
  r := public.t_pin('testeadega', current_setting('t.inativo'), '5555');
  assert (r->>'ok')::boolean = false and r ? 'restantes' and not r ? 'usuario', 'inativo: ' || r::text;
  r := public.t_pin('testeadega', current_setting('t.aleatorio'), '1234');
  assert (r->>'ok')::boolean = false and r ? 'restantes' and not r ? 'usuario', 'aleatório: ' || r::text;

  for i in 1..4 loop
    r := public.t_pin('testeadega', current_setting('t.admin'), '0000');
    assert (r->>'ok')::boolean = false and (r->>'restantes')::int = 5 - i, format('erro %s: %s', i, r);
  end loop;
  r := public.t_pin('testeadega', current_setting('t.admin'), '0000');
  assert (r->>'ok')::boolean = false and r ? 'bloqueado_ate', '5º erro deveria bloquear: ' || r::text;
  r := public.t_pin('testeadega', current_setting('t.admin'), '1234');
  assert (r->>'ok')::boolean = false and (r->>'bloqueado_ate')::timestamptz > now() + interval '4 min', 'PIN certo bloqueado: ' || r::text;
end $$;
reset role;

-- passa o tempo do bloqueio
update testeadega.pin_tentativas set em = em - interval '6 min';

set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","app_metadata":{"schema":"testeadega"}}', true);
do $$
declare r jsonb;
begin
  r := public.t_pin('testeadega', current_setting('t.admin'), '1234');
  assert (r->>'ok')::boolean, 'depois do bloqueio, PIN certo: ' || r::text;
end $$;
reset role;

do $$
begin
  assert (select count(*) from testeadega.pin_tentativas where usuario_id::text = current_setting('t.admin')) = 0, 'acerto não limpou as tentativas';
end $$;

-- ── destrancar volta ao estado de hoje ─────────────────────────────────────
select public.destrancar('testeadega');
do $$
begin
  assert not exists (select 1 from pg_policies where schemaname = 'testeadega' and policyname like 'loja\_%'), 'sobrou policy loja_';
  assert not exists (
    select 1 from information_schema.tables t
    where t.table_schema = 'testeadega' and t.table_type = 'BASE TABLE' and t.table_name not in ('assinatura', 'pin_tentativas')
      and not exists (select 1 from pg_policies p where p.schemaname = 'testeadega' and p.tablename = t.table_name and p.policyname = 'acesso_app')
  ), 'faltou acesso_app depois de destrancar';
end $$;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
begin
  assert (select count(*) from testeadega.produtos) > 0, 'anon não lê produtos depois de destrancar';
  assert (select count(*) from (select pin from testeadega.usuarios) x) > 0, 'anon não lê usuarios depois de destrancar';
  insert into testeadega.vendas (total) values (1);
end $$;
reset role;

-- destrancada: conferir_pin funciona mesmo sem o schema certo no token (migração, passo 3)
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","app_metadata":{"schema":"testeoutra"}}', true);
do $$
declare r jsonb;
begin
  assert (select count(*) from (select pin from testeadega.usuarios) x) > 0, 'authenticated não lê usuarios depois de destrancar';
  r := public.t_pin('testeadega', current_setting('t.admin'), '1234');
  assert (r->>'ok')::boolean, 'conferir_pin com schema destrancado: ' || r::text;
end $$;
reset role;

do $$ begin raise notice 'OK: trava'; end $$;
rollback;
