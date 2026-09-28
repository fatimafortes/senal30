-- SEÑAL 30 — acceso público de solo lectura para /demo.
--
-- Corrección tras retroalimentación del profesor: la URL pública solo
-- llevaba al login de Google, así que un evaluador externo no podía
-- revisar el producto y se perdieron los puntos de "funciona en la URL".
--
-- Aditivo únicamente. Solo agrega políticas RLS nuevas (nunca toca ni
-- reemplaza las existentes) y una tabla + función nuevas para el límite
-- de uso de la demo interactiva. NO usa la service_role key en ningún
-- lado — todo pasa por RLS normal con la anon key pública. Solo toca
-- objetos senal30_. Seguro de correr más de una vez.
--
-- Reglas duras de este archivo:
--   1. Las políticas nuevas son SOLO SELECT, solo para el rol `anon`, y
--      solo sobre filas con is_seed = true (o hijas de un caso
--      is_seed = true). Ningún caso real queda visible sin sesión.
--   2. No se otorga INSERT/UPDATE/DELETE anónimo sobre ninguna de las
--      cuatro tablas de casos.
--   3. La única escritura anónima posible en todo este archivo es, a
--      través de una función security definer de un solo propósito,
--      incrementar un contador de uso diario — nunca una escritura
--      directa a esa tabla, y el límite (15/día) está fijo dentro de la
--      función, no es un parámetro que alguien pueda mandar desde afuera.

-- Defensivo: por si el proyecto compartido no trae ya el grant estándar
-- de Supabase para el rol anon sobre el esquema public (normalmente ya
-- está, esto no cambia nada si es el caso).
grant usage on schema public to anon;

-- 1) Lectura pública de casos semilla ------------------------------------

drop policy if exists senal30_cases_public_demo_select on senal30_cases;
create policy senal30_cases_public_demo_select
  on senal30_cases
  for select
  to anon
  using (is_seed = true);

drop policy if exists senal30_baselines_public_demo_select on senal30_baselines;
create policy senal30_baselines_public_demo_select
  on senal30_baselines
  for select
  to anon
  using (exists (
    select 1 from senal30_cases c
    where c.id = senal30_baselines.case_id and c.is_seed = true
  ));

drop policy if exists senal30_checkpoints_public_demo_select on senal30_checkpoints;
create policy senal30_checkpoints_public_demo_select
  on senal30_checkpoints
  for select
  to anon
  using (exists (
    select 1 from senal30_cases c
    where c.id = senal30_checkpoints.case_id and c.is_seed = true
  ));

drop policy if exists senal30_audit_log_public_demo_select on senal30_audit_log;
create policy senal30_audit_log_public_demo_select
  on senal30_audit_log
  for select
  to anon
  using (exists (
    select 1 from senal30_cases c
    where c.id = senal30_audit_log.case_id and c.is_seed = true
  ));

-- Defensivo y explícito: solo SELECT, nunca más, sin importar qué grants
-- traiga ya el proyecto compartido por defecto.
grant select on senal30_cases, senal30_baselines, senal30_checkpoints, senal30_audit_log to anon;

-- 2) Límite de uso para la clasificación en vivo de /demo -----------------

create table if not exists senal30_demo_usage (
  usage_date date primary key,
  request_count int not null default 0
);

alter table senal30_demo_usage enable row level security;
-- A propósito: CERO políticas de acceso directo a esta tabla, ni para
-- anon ni para authenticated. Se lee y escribe únicamente a través de la
-- función de abajo — nunca por REST directo a la tabla.

create or replace function senal30_try_consume_demo_quota()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count int;
  daily_limit constant int := 15;
begin
  insert into senal30_demo_usage (usage_date, request_count)
  values (current_date, 1)
  on conflict (usage_date) do update
    set request_count = senal30_demo_usage.request_count + 1
    where senal30_demo_usage.request_count < daily_limit
  returning request_count into updated_count;

  -- true si quedó dentro del límite (se cuenta la petición); false si ya
  -- se había alcanzado el tope hoy (no se cuenta, la llamada queda igual).
  return updated_count is not null;
end;
$$;

grant execute on function senal30_try_consume_demo_quota() to anon, authenticated;

-- 3) Verificación — corre esto tú después y revisa el resultado a mano:
--
-- select tablename, policyname, cmd, roles
--   from pg_policies
--  where tablename like 'senal30_%'
--  order by tablename, policyname;
--
-- Debe verse: 4 políticas nuevas *_public_demo_select con cmd = SELECT y
-- roles = {anon}, además de las que ya existían. Ninguna fila con
-- cmd IN ('INSERT','UPDATE','DELETE') debe tener 'anon' en roles.
