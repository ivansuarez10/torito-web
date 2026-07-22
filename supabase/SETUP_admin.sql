-- =====================================================================
--  El Torito · Activar el catálogo editable en la nube
--  Cómo correrlo: Supabase → tu proyecto → SQL Editor → New query →
--  pegar todo esto → RUN.  (1 minuto, una sola vez.)
--
--  Crea la tabla app_config (clave/valor JSON) que usan:
--    - la tienda + /panel  (key = 'store_catalog')
--    - Comandas             (key = 'catalog')  ← de paso enciende su sync en la nube
--  Permisos (RLS): cualquiera puede LEER (la tienda es pública),
--  solo usuarios logueados pueden ESCRIBIR (el panel / Comandas).
-- =====================================================================

create table if not exists public.app_config (
  key         text primary key,
  value       jsonb,
  updated_at  timestamptz default now()
);

alter table public.app_config enable row level security;

-- Lectura pública (la tienda lee el catálogo sin login)
drop policy if exists "app_config lectura publica" on public.app_config;
create policy "app_config lectura publica"
  on public.app_config for select
  using (true);

-- Escritura solo para usuarios autenticados (panel / Comandas)
drop policy if exists "app_config escritura autenticada" on public.app_config;
create policy "app_config escritura autenticada"
  on public.app_config for insert to authenticated
  with check (true);

drop policy if exists "app_config update autenticado" on public.app_config;
create policy "app_config update autenticado"
  on public.app_config for update to authenticated
  using (true) with check (true);

-- Realtime opcional (para que Comandas y la tienda reaccionen al instante)
-- Envuelto para que no falle si ya estaba agregada (re-correr es seguro).
do $$
begin
  alter publication supabase_realtime add table public.app_config;
exception when duplicate_object then null;
end $$;
