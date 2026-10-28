-- Babi&Glow: presencia del catálogo para el contador "En línea ahora" del inventario.
-- Ejecutar una sola vez en Supabase > SQL Editor del proyecto compartido.
create table if not exists public.catalog_visitors (
  visitor_id text primary key,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_visit_date date not null default current_date
);
alter table public.catalog_visitors enable row level security;
revoke all on public.catalog_visitors from anon, authenticated;

create or replace function public.register_catalog_presence(p_visitor_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare result jsonb;
begin
  if p_visitor_id is null or length(p_visitor_id) < 8 or length(p_visitor_id) > 120 then
    raise exception 'Identificador de visitante no válido';
  end if;
  insert into public.catalog_visitors(visitor_id, first_seen_at, last_seen_at, last_visit_date)
  values (p_visitor_id, now(), now(), current_date)
  on conflict (visitor_id) do update
    set last_seen_at = now(), last_visit_date = current_date;
  select jsonb_build_object(
    'total_visitors', (select count(*) from public.catalog_visitors),
    'visitors_today', (select count(*) from public.catalog_visitors where last_visit_date = current_date),
    'online_now', (select count(*) from public.catalog_visitors where last_seen_at > now() - interval '90 seconds')
  ) into result;
  return result;
end;
$$;

create or replace function public.get_catalog_metrics()
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'total_visitors', (select count(*) from public.catalog_visitors),
    'visitors_today', (select count(*) from public.catalog_visitors where last_visit_date = current_date),
    'online_now', (select count(*) from public.catalog_visitors where last_seen_at > now() - interval '90 seconds')
  );
$$;
revoke all on function public.register_catalog_presence(text) from public;
revoke all on function public.get_catalog_metrics() from public;
grant execute on function public.register_catalog_presence(text) to anon, authenticated;
grant execute on function public.get_catalog_metrics() to anon, authenticated;
