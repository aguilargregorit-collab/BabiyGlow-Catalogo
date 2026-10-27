-- Calendario de fechas especiales compartido con el catálogo Babi&Glow.
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 100),
  event_date date not null,
  description text not null default '',
  theme text not null default 'confetti' check (theme in ('confetti','christmas','halloween','hearts','sparkles')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.calendar_events enable row level security;
-- Compatibilidad con el inventario actual, que usa un usuario local y no Supabase Auth.
-- Antes de usarlo comercialmente, migra el acceso a Supabase Auth y restringe escritura.
drop policy if exists "calendar public read active" on public.calendar_events;
drop policy if exists "calendar demo insert" on public.calendar_events;
drop policy if exists "calendar demo update" on public.calendar_events;
drop policy if exists "calendar demo delete" on public.calendar_events;
create policy "calendar public read active" on public.calendar_events for select using (active = true);
create policy "calendar demo insert" on public.calendar_events for insert with check (true);
create policy "calendar demo update" on public.calendar_events for update using (true) with check (true);
create policy "calendar demo delete" on public.calendar_events for delete using (true);
grant select, insert, update, delete on public.calendar_events to anon, authenticated;
alter table public.calendar_events replica identity full;
do $$ begin alter publication supabase_realtime add table public.calendar_events; exception when duplicate_object then null; when undefined_object then null; end $$;
