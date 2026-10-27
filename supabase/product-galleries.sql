-- Babi&Glow: soporte para varias imágenes por producto.
-- Ejecutar UNA VEZ en Supabase > SQL Editor, en el mismo proyecto del inventario.
-- `image_url` se conserva como portada heredada; `image_urls` guarda URLs adicionales
-- (o la lista completa, siempre que image_url siga siendo la portada deseada).

alter table public.products
  add column if not exists image_urls text[] not null default '{}'::text[];

comment on column public.products.image_urls is
  'Galería adicional del producto. El catálogo combina estas URLs con image_url y elimina duplicados.';

-- Los eventos Realtime de products permiten que la galería cambie sin recargar el catálogo.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'products'
  ) then
    alter publication supabase_realtime add table public.products;
  end if;
end $$;
