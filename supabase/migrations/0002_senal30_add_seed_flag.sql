-- SEÑAL 30 — modo de demostración: marca qué casos son datos inventados
-- precargados (no cuentan contra la cuota de Gemini, no representan pacientes
-- reales). Aditivo únicamente: agrega una columna con default, no toca ni
-- borra nada. Sigue tocando solo senal30_cases. Seguro de correr más de una
-- vez.

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'senal30_cases'
      and column_name = 'is_seed'
  ) then
    alter table senal30_cases add column is_seed boolean not null default false;
  end if;
end
$$;
