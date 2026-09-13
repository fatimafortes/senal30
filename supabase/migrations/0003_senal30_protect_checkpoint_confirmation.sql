-- SEÑAL 30 — blinda la confirmación humana (Condición 2) a nivel de base
-- de datos, no solo en el código de la app.
--
-- RLS en senal30_checkpoints (migración 0001) verifica que el checkpoint
-- pertenezca a un caso del usuario, pero no restringe QUÉ columnas puede
-- cambiar ni a QUÉ valores. Como NEXT_PUBLIC_SUPABASE_ANON_KEY es pública
-- por diseño, cualquier usuario técnico podría llamar directo a la API de
-- Supabase (sin pasar por las rutas de la app) y escribir
-- confirmed_by_owner_id con cualquier valor, o cambiar un veredicto ya
-- confirmado. Este trigger lo hace imposible sin importar por dónde
-- llegue la escritura.
--
-- Aditivo únicamente: solo agrega una función y un trigger sobre
-- senal30_checkpoints. No borra ni altera nada existente. Seguro de
-- correr más de una vez.

create or replace function senal30_protect_checkpoint_confirmation()
returns trigger
language plpgsql
as $$
begin
  -- Un checkpoint ya confirmado es inmutable: ni su veredicto, ni su
  -- razón, ni quién lo confirmó pueden cambiar después.
  if tg_op = 'UPDATE' and old.confirmed_by_owner_id is not null then
    if new.verdict is distinct from old.verdict
       or new.ai_rationale is distinct from old.ai_rationale
       or new.confirmed_by_owner_id is distinct from old.confirmed_by_owner_id
       or new.confirmed_at is distinct from old.confirmed_at then
      raise exception 'senal30: checkpoint ya confirmado, no se puede modificar';
    end if;
  end if;

  -- Nadie puede confirmar un checkpoint "como" otro usuario, ni al
  -- insertarlo ni al actualizarlo.
  if new.confirmed_by_owner_id is not null and new.confirmed_by_owner_id <> auth.uid() then
    raise exception 'senal30: confirmed_by_owner_id debe ser quien hace la petición';
  end if;

  return new;
end;
$$;

drop trigger if exists senal30_checkpoints_protect_confirmation on senal30_checkpoints;
create trigger senal30_checkpoints_protect_confirmation
  before insert or update on senal30_checkpoints
  for each row
  execute function senal30_protect_checkpoint_confirmation();
