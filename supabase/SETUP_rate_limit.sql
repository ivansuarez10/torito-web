-- ============================================================================
--  El Torito · freno por IP para `submit-order`, guardado en la BASE
--  Correr UNA vez en: Supabase → SQL Editor
-- ============================================================================
--
--  POR QUÉ EXISTE ESTO
--  `submit-order` es pública (la clienta anónima la llama sin login), así que
--  su único freno contra alguien que inunde el kanban con pedidos falsos es un
--  rate-limit. El que tenía era un contador en MEMORIA del proceso, y medido el
--  8 ago 2026 resultó DECORATIVO: 25 llamadas seguidas desde la misma IP, cero
--  429. Con poco tráfico las Edge Functions levantan proceso nuevo casi por
--  llamada, así que la memoria se borra antes de acumular nada.
--  Un contador que tiene que aguantar reinicios va a la base. Este es el mismo
--  patrón que ya usa el freno por teléfono, que sí funciona.
--
--  QUÉ CREA
--  1) `public.rate_limits` — una fila por clave (hoy `ip:1.2.3.4`) con su
--     ventana y su conteo. Tabla de contadores, sin datos de pedidos.
--  2) `public.rl_hit(clave, segundos, máximo)` — suma 1 y responde `true` si la
--     clave ya se pasó del máximo dentro de la ventana. Todo en UNA sentencia
--     atómica: dos llamadas simultáneas no se pisan el conteo.
--
--  VENTANA FIJA, NO DESLIZANTE
--  El conteo se reinicia cuando la ventana vence, no se arrastra segundo a
--  segundo. En el peor caso deja pasar el doble del máximo justo en el cambio
--  de ventana (8 al final de una + 8 al principio de la siguiente). Para lo que
--  esto frena — un script martillando — da igual, y evita guardar una fila por
--  cada llamada.
--
--  QUIÉN PUEDE LLAMARLA: SOLO EL SERVIDOR
--  Si `anon` pudiera llamar `rl_hit`, cualquiera con la clave publishable (que
--  está a la vista en el HTML) podría inflar el contador de la IP de otra
--  persona y dejarla sin poder pedir. Por eso abajo se le quita el permiso a
--  todo el mundo menos a `service_role`, que es la clave secreta que usa la
--  Edge Function. La tabla queda con RLS y sin políticas: nadie la lee ni la
--  escribe desde el REST público (`service_role` se salta el RLS por diseño).
-- ============================================================================

-- 1) La tabla de contadores
create table if not exists public.rate_limits (
  key          text primary key,
  window_start timestamptz not null default now(),
  hits         integer     not null default 0
);

comment on table public.rate_limits is
  'Contadores de rate-limit por clave (ej. ip:1.2.3.4). Los escribe solo rl_hit() desde las Edge Functions.';

alter table public.rate_limits enable row level security;
-- Sin políticas a propósito: con RLS activo y cero políticas, anon y
-- authenticated no ven ni tocan nada. La Edge Function entra con service_role.

-- 2) La función: suma 1 y dice si ya se pasó
create or replace function public.rl_hit(
  p_key         text,
  p_window_secs integer,
  p_max         integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hits integer;
begin
  insert into public.rate_limits as r (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update set
    -- Si la ventana venció, empieza de cero; si no, suma.
    hits = case when r.window_start < now() - make_interval(secs => p_window_secs)
                then 1 else r.hits + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => p_window_secs)
                        then now() else r.window_start end
  returning r.hits into v_hits;

  -- Higiene: de vez en cuando barre las claves que nadie volvió a usar, para
  -- que la tabla no crezca con una fila por cada IP que pasó alguna vez.
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_hits > p_max;
end;
$$;

comment on function public.rl_hit(text, integer, integer) is
  'Rate-limit de ventana fija. Suma 1 a la clave y devuelve true si ya pasó el máximo. Solo service_role.';

-- 3) Que solo el servidor pueda llamarla
revoke all on function public.rl_hit(text, integer, integer) from public;
revoke all on function public.rl_hit(text, integer, integer) from anon, authenticated;
grant execute on function public.rl_hit(text, integer, integer) to service_role;

-- ============================================================================
--  COMPROBACIÓN (opcional, pegar aparte después de correr lo de arriba)
--  Con máximo 3 en 60 s, las tres primeras dan false y la cuarta true:
--
--    select public.rl_hit('ip:prueba', 60, 3);  -- false
--    select public.rl_hit('ip:prueba', 60, 3);  -- false
--    select public.rl_hit('ip:prueba', 60, 3);  -- false
--    select public.rl_hit('ip:prueba', 60, 3);  -- true
--    delete from public.rate_limits where key = 'ip:prueba';
-- ============================================================================
