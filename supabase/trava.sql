-- ============================================================
-- TRAVA DO BANCO: cada adega só enxerga o próprio schema.
--
-- Depois de trancada:
--   - sem login da loja (anon) não lê nem grava NADA das tabelas da adega
--     (continua funcionando só o cardápio/pedido online e o ping);
--   - a conta da loja (Authentication → usuário com app_metadata.schema = '<adega>')
--     lê e grava só o schema dela;
--   - a coluna pin de usuarios fica escondida; o PIN é conferido no banco por
--     <adega>.conferir_pin (5 erros em 5 min = bloqueado por 5 min).
--
-- ATENÇÃO: só tranque depois que o app dessa adega estiver com o login da loja
-- (NEXT_PUBLIC_LOGIN_LOJA=1) e a conta da loja ligada ao schema:
--   update auth.users set raw_app_meta_data = raw_app_meta_data || '{"schema":"<adega>"}'
--   where email = 'loja.<adega>@...';
-- Se trancar antes, o app para de carregar. Para desfazer: supabase/destrancar-adega.sql
--
-- Como usar (Supabase → SQL Editor):
--   1. Troque 'NOME_DA_ADEGA' lá embaixo (linha "alvo") pelo schema da adega.
--      A demonstração (public) nunca é trancada.
--   2. Rode o script inteiro. Pode rodar de novo sem erro.
--   Adegas criadas pelo nova-adega.sql já nascem trancadas.
-- ============================================================

-- Schema da conta que está logada (vem do token do Supabase Auth)
create or replace function public.schema_da_loja()
returns text
language plpgsql
stable
set search_path = ''
as $$
begin
  return auth.jwt() -> 'app_metadata' ->> 'schema';
end
$$;
revoke all on function public.schema_da_loja() from public;
grant execute on function public.schema_da_loja() to anon, authenticated;

-- Keepalive: não lê tabela de cliente
create or replace function public.ping()
returns boolean
language sql
stable
set search_path = ''
as $$ select true $$;
revoke all on function public.ping() from public;
grant execute on function public.ping() to anon, authenticated;

create or replace function public.instalar_trava(alvo text)
returns void
language plpgsql
as $inst$
declare
  t       text;
  p       text;
  cols    text;
  tipo_id text;
  sobra   text;
  rel_usuarios text;
begin
  if alvo is null or alvo = 'public' then
    raise exception 'A demonstração (public) nunca é trancada. Troque o alvo pelo schema da adega.';
  end if;
  if not exists (select 1 from pg_namespace where nspname = alvo) then
    raise exception 'O schema "%" não existe. Confira o nome da adega na linha "alvo".', alvo;
  end if;
  rel_usuarios := format('%I.usuarios', alvo);
  if to_regclass(rel_usuarios) is null then
    raise exception 'O schema "%" não tem a tabela usuarios.', alvo;
  end if;
  -- o tipo do id de usuarios (uuid ou integer, depende de quando a adega foi criada)
  select format_type(a.atttypid, a.atttypmod) into tipo_id
  from pg_attribute a
  where a.attrelid = rel_usuarios::regclass and a.attname = 'id' and not a.attisdropped;
  if tipo_id is null then
    raise exception 'A tabela %.usuarios não tem coluna id.', alvo;
  end if;

  -- ── Tentativas de PIN (só as funções mexem) ─────────────
  execute format('create table if not exists %I.pin_tentativas (usuario_id %s not null, em timestamptz not null default now())', alvo, tipo_id);
  execute format('create index if not exists pin_tentativas_usuario_em on %I.pin_tentativas (usuario_id, em desc)', alvo);
  execute format('alter table %I.pin_tentativas enable row level security', alvo);
  execute format('revoke all on %I.pin_tentativas from anon, authenticated', alvo);

  -- ── Tabelas: só a conta desta adega ─────────────────────
  execute format('grant usage on schema %I to anon, authenticated', alvo);
  for t in
    select c.relname from pg_class c
    where c.relnamespace = alvo::regnamespace and c.relkind in ('r', 'p')
      and c.relname not in ('assinatura', 'pin_tentativas')
    order by 1
  loop
    execute format('alter table %I.%I enable row level security', alvo, t);
    execute format('drop policy if exists acesso_app on %I.%I', alvo, t);
    execute format('drop policy if exists acesso_app_config on %I.%I', alvo, t);
    execute format('drop policy if exists %I on %I.%I', 'loja_' || t, alvo, t);
    execute format('create policy %I on %I.%I for all to authenticated using ((select public.schema_da_loja()) = %L) with check ((select public.schema_da_loja()) = %L)',
                   'loja_' || t, alvo, t, alvo, alvo);
    execute format('revoke all on %I.%I from anon', alvo, t);
    -- sem TRUNCATE/TRIGGER/REFERENCES: TRUNCATE passaria por cima da policy
    execute format('revoke all on %I.%I from authenticated', alvo, t);
    execute format('grant select, insert, update, delete on %I.%I to authenticated', alvo, t);
  end loop;

  -- Qualquer outra policy liberada somaria acesso (policies se somam): não tranca pela metade
  select string_agg(format('%s.%s', tablename, policyname), ', ') into sobra
  from pg_policies
  where schemaname = alvo and tablename not in ('assinatura', 'pin_tentativas')
    and policyname not like 'loja\_%' and permissive = 'PERMISSIVE';
  if sobra is not null then
    raise exception 'Policies que deixariam a adega aberta: %. Apague essas policies e rode de novo.', sobra;
  end if;

  -- ── PIN escondido: a conta da loja lê usuarios sem a coluna pin ───
  execute format('revoke select on %I.usuarios from authenticated', alvo);
  select string_agg(quote_ident(a.attname), ', ' order by a.attnum) into cols
  from pg_attribute a
  where a.attrelid = rel_usuarios::regclass and a.attnum > 0 and not a.attisdropped and a.attname <> 'pin';
  execute format('grant select (%s) on %I.usuarios to authenticated', cols, alvo);

  -- ── Sequences e tabelas futuras ─────────────────────────
  execute format('revoke all on all sequences in schema %I from anon, authenticated', alvo);
  execute format('grant usage, select on all sequences in schema %I to authenticated', alvo);
  -- tabela/sequence criada depois (migração nova) nasce fechada: rode este script de novo pra ela ganhar a policy
  execute format('alter default privileges in schema %I revoke all on tables from anon, authenticated', alvo);
  execute format('alter default privileges in schema %I revoke all on sequences from anon, authenticated', alvo);
  -- funções: tira o que foi dado por schema aos papéis do app. O execute para PUBLIC que o Postgres dá
  -- a toda função nova é global e não dá pra tirar só neste schema: função security definer nova
  -- precisa de "revoke all on function ... from public" explícito (como conferir_pin).
  execute format('alter default privileges in schema %I revoke all on functions from anon, authenticated', alvo);

  -- ── Conferência do PIN ──────────────────────────────────
  execute format($f$
    create or replace function %1$I.conferir_pin(p_usuario %3$s, p_pin text)
    returns jsonb
    language plpgsql
    volatile
    security definer
    set search_path = %1$I, pg_temp
    as $fn$
    declare
      v_u     record;
      v_ult   timestamptz[];
      v_erros int;
    begin
      -- Trancada: só a conta desta adega. Destrancada (migração): qualquer conta logada.
      if exists (select 1 from pg_catalog.pg_policy where polrelid = %4$L::regclass and polname like 'loja\_%%')
         and public.schema_da_loja() is distinct from %2$L then
        return jsonb_build_object('ok', false);
      end if;
      if p_usuario is null then
        return jsonb_build_object('ok', false, 'restantes', 5);
      end if;

      -- uma conferência por vez para o mesmo usuário (senão dá pra chutar em paralelo)
      perform pg_advisory_xact_lock(hashtextextended(%2$L || ':' || p_usuario::text, 0));
      delete from pin_tentativas where em < now() - interval '1 day';

      -- bloqueado: 5 erros em menos de 5 min, e o 5º foi há menos de 5 min
      select array_agg(em order by em desc) into v_ult
      from (select em from pin_tentativas where usuario_id = p_usuario order by em desc limit 5) x;
      if cardinality(v_ult) = 5 and v_ult[1] - v_ult[5] < interval '5 min' and v_ult[1] + interval '5 min' > now() then
        return jsonb_build_object('ok', false, 'bloqueado_ate', v_ult[1] + interval '5 min');
      end if;

      select id, nome, cargo into v_u
      from usuarios where id = p_usuario and coalesce(ativo, false) and pin = p_pin;
      if found then
        delete from pin_tentativas where usuario_id = p_usuario;
        return jsonb_build_object('ok', true, 'usuario', jsonb_build_object('id', v_u.id, 'nome', v_u.nome, 'cargo', v_u.cargo));
      end if;

      -- errado, inativo ou inexistente: mesma resposta
      insert into pin_tentativas (usuario_id) values (p_usuario);
      select count(*) into v_erros from pin_tentativas where usuario_id = p_usuario and em > now() - interval '5 min';
      if v_erros >= 5 then
        return jsonb_build_object('ok', false, 'bloqueado_ate', now() + interval '5 min');
      end if;
      return jsonb_build_object('ok', false, 'restantes', 5 - v_erros);
    end
    $fn$;
  $f$, alvo, alvo, tipo_id, rel_usuarios);

  p := format('%I.conferir_pin(%s, text)', alvo, tipo_id);
  execute format('revoke all on function %s from public, anon', p);
  execute format('grant execute on function %s to authenticated', p);
end
$inst$;

-- Desfaz a trava: volta ao acesso liberado de antes (as funções novas ficam, não atrapalham)
create or replace function public.destrancar(alvo text)
returns void
language plpgsql
as $inst$
declare
  t text;
  p record;
begin
  if alvo is null or alvo = 'public' then
    raise exception 'A demonstração (public) nunca é trancada. Troque o alvo pelo schema da adega.';
  end if;
  if not exists (select 1 from pg_namespace where nspname = alvo) then
    raise exception 'O schema "%" não existe. Confira o nome da adega na linha "alvo".', alvo;
  end if;

  for p in select tablename, policyname from pg_policies where schemaname = alvo and policyname like 'loja\_%' loop
    execute format('drop policy %I on %I.%I', p.policyname, alvo, p.tablename);
  end loop;

  execute format('grant usage on schema %I to anon, authenticated', alvo);
  for t in
    select c.relname from pg_class c
    where c.relnamespace = alvo::regnamespace and c.relkind in ('r', 'p')
      and c.relname not in ('assinatura', 'pin_tentativas')
    order by 1
  loop
    execute format('alter table %I.%I enable row level security', alvo, t);
    if not exists (select 1 from pg_policies where schemaname = alvo and tablename = t and policyname = 'acesso_app') then
      execute format('create policy acesso_app on %I.%I for all using (true) with check (true)', alvo, t);
    end if;
    -- inclui o select completo de usuarios (com pin)
    execute format('grant all on %I.%I to anon, authenticated', alvo, t);
  end loop;

  execute format('grant all on all sequences in schema %I to anon, authenticated', alvo);
  -- padrão de antes (nova-adega.sql passo 3): tabela nova nasce liberada pro app
  execute format('alter default privileges in schema %I grant all on tables to anon, authenticated', alvo);
end
$inst$;

-- Instalador e destrancar são só pra você no SQL Editor: o app não pode chamar
revoke all on function public.instalar_trava(text) from public, anon, authenticated;
revoke all on function public.destrancar(text) from public, anon, authenticated;

do $$
declare
  alvo text := 'NOME_DA_ADEGA';   -- <<< SCHEMA DA ADEGA (nunca 'public')
begin
  perform public.instalar_trava(alvo);
end $$;

-- Recarrega o cache da API para as funções aparecerem na hora
notify pgrst, 'reload schema';
