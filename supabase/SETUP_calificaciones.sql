-- ============================================================================
--  El Torito · calificaciones de pedidos ("¿Cómo estuvo?")
--  Correr UNA vez en: Supabase → SQL Editor
-- ============================================================================
--  El cliente con sesión califica de 1 a 5 SOLO pedidos suyos ya entregados.
--  Puede corregir su calificación (tocó 3, quería 5). Nadie puede calificar
--  pedidos ajenos: la regla verifica contra `orders` que el folio sea suyo,
--  con el mismo criterio de últimos-8-dígitos del permiso de lectura.
--  El personal (correo @eltorito.hn) puede leerlas todas.
-- ============================================================================

create table if not exists public.torito_ratings (
  folio      text primary key,
  phone      text default (auth.jwt() ->> 'phone'),
  stars      int  not null check (stars between 1 and 5),
  comment    text,
  created_at timestamptz not null default now()
);

alter table public.torito_ratings enable row level security;

drop policy if exists "cliente califica su pedido"   on public.torito_ratings;
drop policy if exists "cliente corrige su estrella"  on public.torito_ratings;
drop policy if exists "cliente ve sus calificaciones" on public.torito_ratings;
drop policy if exists "personal lee calificaciones"  on public.torito_ratings;

-- el folio tiene que ser de un pedido SUYO
create policy "cliente califica su pedido"
on public.torito_ratings for insert to authenticated
with check (
  length(regexp_replace(coalesce(auth.jwt() ->> 'phone',''),'\D','','g')) >= 8
  and exists (
    select 1 from public.orders o
    where o.folio = torito_ratings.folio
      and right(regexp_replace(coalesce(o.phone,''),'\D','','g'),8)
        = right(regexp_replace(auth.jwt() ->> 'phone','\D','','g'),8)
  )
);

create policy "cliente corrige su estrella"
on public.torito_ratings for update to authenticated
using (
  length(regexp_replace(coalesce(auth.jwt() ->> 'phone',''),'\D','','g')) >= 8
  and right(regexp_replace(coalesce(phone,''),'\D','','g'),8)
    = right(regexp_replace(auth.jwt() ->> 'phone','\D','','g'),8)
);

create policy "cliente ve sus calificaciones"
on public.torito_ratings for select to authenticated
using (
  length(regexp_replace(coalesce(auth.jwt() ->> 'phone',''),'\D','','g')) >= 8
  and right(regexp_replace(coalesce(phone,''),'\D','','g'),8)
    = right(regexp_replace(auth.jwt() ->> 'phone','\D','','g'),8)
);

-- el personal entra con correo @eltorito.hn → puede leerlas todas
create policy "personal lee calificaciones"
on public.torito_ratings for select to authenticated
using ( coalesce(auth.jwt() ->> 'email','') like '%@eltorito.hn' );

-- ── COMPROBACIÓN ──
select policyname, cmd from pg_policies
where tablename = 'torito_ratings' order by policyname;
