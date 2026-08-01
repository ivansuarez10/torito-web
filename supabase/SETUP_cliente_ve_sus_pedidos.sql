-- ============================================================================
--  El Torito · permiso para que un CLIENTE vea SUS PROPIOS pedidos
--  Correr UNA vez en: Supabase → SQL Editor
-- ============================================================================
--
--  QUÉ HACE
--  Hoy la tabla `orders` está cerrada: el sitio no puede leer ningún pedido
--  (comprobado — devuelve vacío aunque existan). Esta regla abre UNA rendija:
--  un cliente que inició sesión con su teléfono puede leer las filas cuyo
--  teléfono coincide con el suyo. Nada más. No puede ver los de otros, ni
--  crear, ni modificar, ni borrar.
--
--  POR QUÉ COMPARA LOS ÚLTIMOS 8 DÍGITOS
--  La tienda guarda el teléfono como lo escribe el cliente (99998888) y
--  Supabase Auth lo guarda en formato internacional (+50499998888). Si se
--  comparan en crudo NO COINCIDEN NUNCA y la lista sale vacía sin ningún
--  error visible. Comparando los últimos 8 dígitos funciona con los pedidos
--  viejos también, sin migrar nada. Es el mismo criterio que ya usa Comandas.
--
--  POR QUÉ EL GUARD DE `length >= 8`
--  El personal (admin@ / carnicero@) entra con CORREO, así que su sesión no
--  trae teléfono. Sin ese guard, su teléfono vacío coincidiría con cualquier
--  pedido que también tenga el teléfono vacío (los cargados a mano en el
--  mostrador). Con el guard, esta regla simplemente no les aplica y su acceso
--  de siempre queda intacto.
--
--  NOTA: las políticas se SUMAN, no se restan. Agregar esta no le quita
--  permisos a nadie que ya los tenga.
-- ============================================================================

-- 1) La regla
drop policy if exists "cliente ve sus propios pedidos" on public.orders;

create policy "cliente ve sus propios pedidos"
on public.orders
for select
to authenticated
using (
  -- solo cuentas creadas con teléfono
  length(regexp_replace(coalesce(auth.jwt() ->> 'phone', ''), '\D', '', 'g')) >= 8
  and
  right(regexp_replace(coalesce(orders.phone, ''), '\D', '', 'g'), 8)
  =
  right(regexp_replace(auth.jwt() ->> 'phone', '\D', '', 'g'), 8)
);

-- 2) Asegurar que RLS siga encendida (no la apaga, solo confirma)
alter table public.orders enable row level security;


-- ============================================================================
--  COMPROBACIÓN — corré esto después y pegame el resultado
-- ============================================================================

-- a) ¿Quedó creada la regla?
select policyname, cmd, roles
from pg_policies
where schemaname = 'public' and tablename = 'orders'
order by policyname;

-- b) ¿La comparación de teléfonos funciona con TUS datos reales?
--    Cambiá el 31738030 por el celular con el que vas a probar.
--    Tiene que devolver los pedidos de ese número (o 0 filas si nunca pidió).
select
  folio,
  status,
  phone                                                as guardado,
  right(regexp_replace(coalesce(phone,''),'\D','','g'), 8) as ultimos_8,
  to_timestamp(created_at/1000)                        as fecha
from public.orders
where right(regexp_replace(coalesce(phone,''),'\D','','g'), 8) = '31738030'
order by created_at desc
limit 10;
