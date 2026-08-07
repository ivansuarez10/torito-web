-- ============================================================================
--  Medición del carrito · Tienda El Torito
--  Correr UNA vez en: Supabase → SQL Editor → New query → Run
-- ============================================================================
--
--  Para qué sirve: la tabla `orders` solo guarda lo que SÍ se compró. Esto guarda
--  lo que se agregó al carrito, aunque después no se haya pedido — que es la única
--  forma de saber qué producto llama la atención pero frena la compra.
--
--  Privacidad: por defecto es ANÓNIMO. `sid` es un identificador de navegador que
--  no dice quién es nadie. El teléfono se guarda SOLO si la clienta inició sesión.
--
--  Seguridad: se puede ESCRIBIR sin login (el sitio público lo necesita), pero
--  NO se puede LEER sin login. Un curioso con la clave pública no puede sacar
--  nada de acá — igual que con `orders`.
-- ============================================================================

create table if not exists public.cart_events (
  id           bigserial primary key,
  at           timestamptz not null default now(),
  sid          text,               -- id anónimo de navegador (no identifica a la persona)
  action       text not null,      -- 'add' | 'checkout' | 'sent'
  product_id   text,
  product_name text,
  qty          numeric,
  n_items      int,                -- cuántas líneas llevaba el carrito (checkout / sent)
  folio         text,              -- solo en 'sent', para cruzarlo con orders
  phone        text                -- SOLO si inició sesión; null si es anónimo
);

-- Solo se aceptan estas tres acciones: si alguien intenta meter basura, se rechaza.
alter table public.cart_events
  drop constraint if exists cart_events_action_check;
alter table public.cart_events
  add constraint cart_events_action_check
  check (action in ('add','checkout','sent'));

-- Consultas por fecha y por producto: sin esto, con miles de filas se vuelve lento.
create index if not exists cart_events_at_idx      on public.cart_events (at desc);
create index if not exists cart_events_product_idx on public.cart_events (product_id);

-- ---------------------------------------------------------------------------
--  Seguridad de filas
-- ---------------------------------------------------------------------------
alter table public.cart_events enable row level security;

-- Escribir: sí, sin login. Lo necesita el sitio público.
drop policy if exists "cart_events insert publico" on public.cart_events;
create policy "cart_events insert publico"
  on public.cart_events for insert
  to anon, authenticated
  with check (true);

-- Leer: SOLO con sesión iniciada (vos y el personal). Nadie más.
drop policy if exists "cart_events lectura staff" on public.cart_events;
create policy "cart_events lectura staff"
  on public.cart_events for select
  to authenticated
  using (true);

-- ============================================================================
--  CONSULTAS PARA MIRAR LOS DATOS (correr cuando ya haya movimiento)
-- ============================================================================

-- 1) Lo importante: qué se agrega y qué termina en pedido, por producto.
--    "conversion" baja = llama la atención pero algo frena la compra.
/*
with agregados as (
  select product_name, count(*) as veces_agregado, count(distinct sid) as personas
  from cart_events where action='add' and at > now() - interval '30 days'
  group by 1
),
comprados as (
  select i->>'name' as product_name, count(*) as veces_comprado
  from orders o, jsonb_array_elements(o.items) i
  where o.created_at > (extract(epoch from now())*1000 - 30*86400000)
  group by 1
)
select a.product_name, a.veces_agregado, a.personas,
       coalesce(c.veces_comprado,0) as veces_comprado,
       round(100.0*coalesce(c.veces_comprado,0)/a.veces_agregado) as conversion_pct
from agregados a left join comprados c using (product_name)
order by a.veces_agregado desc;
*/

-- 2) El embudo: de los que agregaron algo, ¿cuántos llegaron al checkout y cuántos
--    mandaron el pedido? La caída más grande te dice dónde está el problema.
/*
select
  count(distinct sid) filter (where action='add')      as agregaron_algo,
  count(distinct sid) filter (where action='checkout') as llegaron_al_checkout,
  count(distinct sid) filter (where action='sent')     as mandaron_el_pedido
from cart_events
where at > now() - interval '30 days';
*/

-- 3) Carritos abandonados CON identidad (solo clientas que iniciaron sesión).
--    Hoy va a devolver poco: al 7 ago hay 4 cuentas y 2 son del personal.
/*
select phone, max(at) as ultimo_movimiento,
       array_agg(distinct product_name) filter (where product_name is not null) as productos
from cart_events
where phone is not null
  and at > now() - interval '7 days'
  and sid not in (select sid from cart_events where action='sent' and sid is not null)
group by phone
order by ultimo_movimiento desc;
*/
