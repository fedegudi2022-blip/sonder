-- Sonder: biblioteca en la nube (Etapa 6)
-- Cómo aplicarlo: Supabase Dashboard > SQL Editor > pega esto > Run.
-- Tablas por usuario con RLS: cada uno solo ve lo suyo.

create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  track_id text not null,
  track jsonb not null default '{}',
  created_at timestamptz not null default now(),
  primary key (user_id, track_id)
);

create table if not exists public.playlists (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Nueva playlist',
  track_ids jsonb not null default '[]',
  tracks jsonb not null default '{}',
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.follows (
  user_id uuid not null references auth.users(id) on delete cascade,
  artist_id text not null,
  artist jsonb not null default '{}',
  created_at timestamptz not null default now(),
  primary key (user_id, artist_id)
);

alter table public.favorites enable row level security;
alter table public.playlists enable row level security;
alter table public.follows enable row level security;

drop policy if exists "owner_all" on public.favorites;
create policy "owner_all" on public.favorites
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "owner_all" on public.playlists;
create policy "owner_all" on public.playlists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "owner_all" on public.follows;
create policy "owner_all" on public.follows
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
