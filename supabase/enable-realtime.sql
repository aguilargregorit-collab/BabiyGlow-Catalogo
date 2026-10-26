-- Ejecuta esto en Supabase > SQL Editor para que el catálogo reciba cambios en vivo.
-- Si la tabla ya está en la publicación realtime, el bloque evita duplicarla.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'products'
  ) then
    alter publication supabase_realtime add table public.products;
  end if;
end $$;
