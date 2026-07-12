-- If an existing account signed up as Store but landed on the customer designer,
-- run this in Supabase SQL Editor after confirming their email.
-- Replace the email below first.

-- update public.profiles
-- set role = 'store'
-- where email = 'store-owner@example.com';

-- Sync all profiles from auth user metadata (safe if metadata.role is set):
update public.profiles p
set role = coalesce(nullif(u.raw_user_meta_data->>'role', ''), p.role)
from auth.users u
where u.id = p.id
  and coalesce(nullif(u.raw_user_meta_data->>'role', ''), '') in ('customer', 'store');
