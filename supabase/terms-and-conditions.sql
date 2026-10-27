-- Babi&Glow: términos y condiciones compartidos entre Supabase, catálogo e inventario.
-- Ejecuta este archivo en Supabase > SQL Editor usando el mismo proyecto del inventario.

create table if not exists public.catalog_terms (
  id integer primary key default 1 check (id = 1),
  title text not null default 'Términos y condiciones',
  content text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.catalog_terms enable row level security;

grant select on public.catalog_terms to anon, authenticated;
grant insert, update, delete on public.catalog_terms to authenticated;

drop policy if exists "Public can read catalog terms" on public.catalog_terms;
create policy "Public can read catalog terms"
  on public.catalog_terms
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Authenticated users can manage catalog terms" on public.catalog_terms;
create policy "Authenticated users can manage catalog terms"
  on public.catalog_terms
  for all
  to authenticated
  using (true)
  with check (true);

insert into public.catalog_terms (id, title, content)
values (
  1,
  'Términos y condiciones',
  $terms$1. Disponibilidad de productos
La disponibilidad que aparece en el catálogo refleja la información recibida del inventario y puede cambiar. Confirma la existencia del producto antes de realizar el pago.

2. Precios
Los precios se muestran en dólares estadounidenses (USD), salvo que se indique lo contrario. El precio final debe confirmarse al momento de gestionar el pedido.

3. Pedidos y confirmación
Enviar una consulta o mensaje no reserva automáticamente un producto. Babi&Glow confirmará contigo la disponibilidad y los detalles del pedido.

4. Descripción e imágenes
Las imágenes y descripciones sirven como referencia. Puede haber pequeñas variaciones de presentación o empaque respecto a las fotografías.

5. Actualizaciones
El catálogo, los precios, la disponibilidad y estas condiciones pueden actualizarse. La versión publicada en esta página es la que se encuentra vigente.$terms$
)
on conflict (id) do nothing;

-- Actualiza la fecha automáticamente al modificar título o contenido.
create or replace function public.set_catalog_terms_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists catalog_terms_updated_at on public.catalog_terms;
create trigger catalog_terms_updated_at
before update on public.catalog_terms
for each row execute function public.set_catalog_terms_updated_at();

-- Habilita Realtime sin intentar añadir la misma tabla dos veces.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'catalog_terms'
  ) then
    alter publication supabase_realtime add table public.catalog_terms;
  end if;
end $$;
