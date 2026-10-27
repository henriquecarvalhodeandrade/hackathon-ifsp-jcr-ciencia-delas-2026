-- =============================================================================
-- Ciência Delas — "shim" mínimo de pgTAP para a validação local sem Docker.
--
-- Os testes em supabase/tests/database/*.sql usam só no_plan(), pass(), ok() e
-- finish(). No Supabase (`supabase test db`) eles vêm da extensão pgtap de
-- verdade; aqui, se ela não estiver disponível no servidor, criamos versões
-- simples com a mesma assinatura (as falhas reais são exceções nos blocos DO).
-- =============================================================================
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pgtap') then
    create extension if not exists pgtap with schema extensions;
    return;
  end if;

  create sequence if not exists extensions.__tap_counter;

  create or replace function extensions.no_plan()
  returns setof boolean
  language plpgsql
  as $f$
  begin
    perform setval('extensions.__tap_counter', 1, false);
    return;
  end;
  $f$;

  create or replace function extensions.ok(boolean, text default '')
  returns text
  language plpgsql
  as $f$
  declare
    n bigint := nextval('extensions.__tap_counter');
  begin
    if $1 is not true then
      raise exception 'not ok % - %', n, $2;
    end if;
    return format('ok %s - %s', n, $2);
  end;
  $f$;

  create or replace function extensions.pass(text default '')
  returns text
  language sql
  as $f$ select extensions.ok(true, $1); $f$;

  create or replace function extensions.finish()
  returns setof text
  language plpgsql
  as $f$
  declare
    n bigint;
  begin
    select last_value - case when is_called then 0 else 1 end into n from extensions.__tap_counter;
    return next format('1..%s', n);
  end;
  $f$;
end
$$;
