-- Sebas XP cloud sync: paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run more than once.

-- One row per logged activity. `data` is the entry exactly as the app stores it.
create table if not exists public.entries (
  user_id    uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  id         text        not null,
  date       text        not null,
  data       jsonb       not null,
  deleted    boolean     not null default false,   -- deletes leave a marker so other devices remove it too
  device     text        not null default '',      -- which device wrote it (a device skips its own changes when downloading)
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- Small documents: 'settings', 'badges', and one 'quests:YYYY-MM-DD' per week.
create table if not exists public.docs (
  user_id    uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  key        text        not null,
  value      jsonb       not null,
  device     text        not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- (for anyone who ran an earlier version of this file)
alter table public.entries add column if not exists device text not null default '';
alter table public.docs    add column if not exists device text not null default '';

create index if not exists entries_user_updated on public.entries (user_id, updated_at);
create index if not exists docs_user_updated    on public.docs    (user_id, updated_at);

-- Every write gets a fresh server timestamp, so devices can ask "what changed since I last looked?"
create or replace function public.sebasxp_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists entries_touch on public.entries;
create trigger entries_touch before insert or update on public.entries
  for each row execute function public.sebasxp_touch();

drop trigger if exists docs_touch on public.docs;
create trigger docs_touch before insert or update on public.docs
  for each row execute function public.sebasxp_touch();

-- Row level security: signed-in users can only see and change their own rows. Nobody else can read anything.
alter table public.entries enable row level security;
alter table public.docs    enable row level security;

drop policy if exists "own entries" on public.entries;
create policy "own entries" on public.entries for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "own docs" on public.docs;
create policy "own docs" on public.docs for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Let signed-in users use the tables through the API (row level security above still limits them to their own rows).
grant select, insert, update, delete on public.entries, public.docs to authenticated;
revoke all on public.entries, public.docs from anon;
