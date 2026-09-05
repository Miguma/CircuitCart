-- =======================================================
-- CIRCUITCART DATABASE SCHEMA: PROFILES & AUTH FOUNDATION
-- =======================================================

-- 1. Create profiles table linked to Supabase auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  username text unique,
  avatar_url text,
  location text,
  bio text,
  role text not null default 'buyer' check (role in ('buyer', 'seller', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Enable Row Level Security (RLS) on profiles
alter table public.profiles enable row level security;

-- 3. RLS Policies
-- Policy A: Anyone can view public profile details
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
create policy "Public profiles are viewable by everyone"
  on public.profiles
  for select
  using (true);

-- Policy B: Users can insert their own profile with role = 'buyer' only
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can insert their own profile as buyer" on public.profiles;
create policy "Users can insert their own profile as buyer"
  on public.profiles
  for insert
  with check (
    auth.uid() = id
    and role = 'buyer'
  );

-- Policy C: Users can update their own editable profile fields, but cannot change role
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can update own profile except role" on public.profiles;
create policy "Users can update own profile except role"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select p.role from public.profiles p where p.id = auth.uid())
  );

-- 4. Database Trigger: Hard block on user-driven role modifications
create or replace function public.protect_profile_role()
returns trigger as $$
begin
  if new.role is distinct from old.role then
    -- Only allow role changes if executed by trusted backend service_role, postgres, or supabase_admin
    if current_user not in ('service_role', 'postgres', 'supabase_admin') then
      raise exception 'Unauthorized: Profile role cannot be changed directly by user. Verification or admin action required.';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists enforce_profile_role_protection on public.profiles;
create trigger enforce_profile_role_protection
  before update on public.profiles
  for each row
  execute function public.protect_profile_role();

-- 5. Function & Trigger for automatic updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.handle_updated_at();

-- 6. Function & Trigger for automatic Profile creation on User Signup
create or replace function public.handle_new_user()
returns trigger as $$
declare
  user_full_name text;
  user_username text;
  clean_username text;
begin
  user_full_name := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', '');
  user_username := coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1));
  clean_username := lower(regexp_replace(user_username, '[^a-zA-Z0-9_]', '', 'g'));

  if clean_username = '' then
    clean_username := 'user_' || substr(new.id::text, 1, 8);
  end if;

  insert into public.profiles (id, full_name, username, role, created_at, updated_at)
  values (
    new.id,
    user_full_name,
    clean_username,
    'buyer',
    now(),
    now()
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    updated_at = now();

  return new;
end;
$$ language plpgsql security definer;

-- Trigger to execute upon auth.users insert
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
