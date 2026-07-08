-- Run in Supabase SQL Editor (Dashboard → SQL → New query)

create extension if not exists "pgcrypto";

-- Profiles (one per auth user)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('customer', 'store')),
  email text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are readable by owner"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Profiles are insertable by owner"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Profiles are updatable by owner"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create profile when a user signs up (runs as security definer, bypasses RLS).
-- Role comes from signUp metadata: options.data.role ('customer' | 'store').
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, email)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'role', ''), 'customer'),
    coalesce(new.email, '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Quilt shops
create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles (id) on delete cascade,
  store_name text not null,
  address text not null,
  email text not null,
  created_at timestamptz not null default now()
);

create index if not exists stores_store_name_idx on public.stores (store_name);

alter table public.stores enable row level security;

create policy "Stores are publicly readable"
  on public.stores for select
  using (true);

create policy "Store owners can insert their store"
  on public.stores for insert
  with check (auth.uid() = owner_id);

create policy "Store owners can update their store"
  on public.stores for update
  using (auth.uid() = owner_id);

-- Fabrics listed by stores
create table if not exists public.fabrics (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null default 'Fabric',
  image_url text not null,
  price_per_yard numeric(10, 2) not null check (price_per_yard >= 0),
  primary_color text not null,
  created_at timestamptz not null default now()
);

create index if not exists fabrics_store_id_idx on public.fabrics (store_id);

alter table public.fabrics enable row level security;

create policy "Fabrics are publicly readable"
  on public.fabrics for select
  using (true);

create policy "Store owners can manage their fabrics"
  on public.fabrics for all
  using (
    exists (
      select 1 from public.stores s
      where s.id = fabrics.store_id and s.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.stores s
      where s.id = fabrics.store_id and s.owner_id = auth.uid()
    )
  );

-- Storage bucket for fabric swatch images (create in Dashboard → Storage if this fails)
insert into storage.buckets (id, name, public)
values ('fabric-images', 'fabric-images', true)
on conflict (id) do nothing;

create policy "Fabric images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'fabric-images');

create policy "Authenticated users can upload fabric images"
  on storage.objects for insert
  with check (bucket_id = 'fabric-images' and auth.role() = 'authenticated');

create policy "Users can update their fabric images"
  on storage.objects for update
  using (bucket_id = 'fabric-images' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can delete their fabric images"
  on storage.objects for delete
  using (bucket_id = 'fabric-images' and auth.uid()::text = (storage.foldername(name))[1]);
