create extension if not exists pgcrypto;

create table if not exists public.profiles(
 id uuid primary key references auth.users(id) on delete cascade,
 name text default 'Utente',
 monthly_income numeric(12,2) default 0,
 saving_goal numeric(12,2) default 0,
 strategy text default 'balanced',
 created_at timestamptz default now()
);
create table if not exists public.transactions(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 type text not null check(type in('income','expense')),
 description text not null,
 category text not null,
 amount numeric(12,2) not null check(amount>0),
 date date not null,
 recurring text default 'none',
 created_at timestamptz default now()
);
create table if not exists public.budgets(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 category text not null,
 limit_amount numeric(12,2) not null default 0,
 unique(user_id,category)
);
create table if not exists public.goals(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 name text not null,
 target_amount numeric(12,2) not null check(target_amount>0),
 current_amount numeric(12,2) not null default 0,
 deadline date,
 created_at timestamptz default now()
);

alter table public.profiles enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.goals enable row level security;

create policy "profiles own" on public.profiles for all using(auth.uid()=id) with check(auth.uid()=id);
create policy "transactions own" on public.transactions for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy "budgets own" on public.budgets for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy "goals own" on public.goals for all using(auth.uid()=user_id) with check(auth.uid()=user_id);

create or replace function public.new_profile() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.profiles(id) values(new.id) on conflict do nothing; return new; end $$;
drop trigger if exists user_profile_trigger on auth.users;
create trigger user_profile_trigger after insert on auth.users for each row execute procedure public.new_profile();
