-- Saved customer quilt designs (run in Supabase SQL Editor)

create table if not exists public.saved_designs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null default 'Untitled quilt',
  payload jsonb not null,
  quilt_width numeric(10, 2),
  quilt_height numeric(10, 2),
  preview_colors text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists saved_designs_user_id_updated_at_idx
  on public.saved_designs (user_id, updated_at desc);

alter table public.saved_designs enable row level security;

create policy "Customers can read their saved designs"
  on public.saved_designs for select
  using (auth.uid() = user_id);

create policy "Customers can insert their saved designs"
  on public.saved_designs for insert
  with check (auth.uid() = user_id);

create policy "Customers can update their saved designs"
  on public.saved_designs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Customers can delete their saved designs"
  on public.saved_designs for delete
  using (auth.uid() = user_id);

create or replace function public.set_saved_designs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists saved_designs_set_updated_at on public.saved_designs;
create trigger saved_designs_set_updated_at
  before update on public.saved_designs
  for each row execute function public.set_saved_designs_updated_at();
