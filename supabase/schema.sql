-- Run this once in Supabase Dashboard -> SQL Editor.
create table if not exists public.maxiom_vaults (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);

alter table public.maxiom_vaults enable row level security;
revoke all on public.maxiom_vaults from anon, authenticated;
grant select, insert, update on public.maxiom_vaults to authenticated;

create policy "Read own vault" on public.maxiom_vaults
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Create own vault" on public.maxiom_vaults
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own vault" on public.maxiom_vaults
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
