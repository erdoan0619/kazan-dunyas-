-- Kazanç Dünyası initial schema. Run in Supabase SQL editor.
create extension if not exists pgcrypto;

create type public.app_role as enum ('user', 'admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (char_length(username) between 2 and 30),
  role public.app_role not null default 'user',
  points_balance bigint not null default 0 check (points_balance >= 0),
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 80),
  description text not null check (char_length(description) between 2 and 300),
  points integer not null check (points between 1 and 1000),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.task_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  task_id uuid not null references public.tasks(id),
  points_awarded integer not null check (points_awarded between 1 and 1000),
  completed_at timestamptz not null default now(),
  unique(user_id, task_id)
);

create table public.point_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  delta integer not null check (delta <> 0),
  reason text not null check (char_length(reason) between 2 and 160),
  task_completion_id uuid references public.task_completions(id),
  created_at timestamptz not null default now()
);

create index task_completions_user_idx on public.task_completions(user_id);
create index point_ledger_user_created_idx on public.point_ledger(user_id, created_at desc);

create function public.is_admin()
returns boolean language sql stable security definer
set search_path = public
as $$ select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin') $$;

create function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles(id, username)
  values (new.id, coalesce(nullif(left(new.raw_user_meta_data->>'username',30),''), 'Yeni Kullanıcı'));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.task_completions enable row level security;
alter table public.point_ledger enable row level security;

create policy "Users can read own profile" on public.profiles
for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "Users can update own username only" on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and role = (select p.role from public.profiles p where p.id = auth.uid()) and points_balance = (select p.points_balance from public.profiles p where p.id = auth.uid()));
create policy "Authenticated users read active tasks" on public.tasks
for select to authenticated using (active = true or public.is_admin());
create policy "Admins insert tasks" on public.tasks
for insert to authenticated with check (public.is_admin());
create policy "Admins update tasks" on public.tasks
for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Users read own completions" on public.task_completions
for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "Users read own ledger" on public.point_ledger
for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- Do not grant clients INSERT/UPDATE access to completions, ledger, or balances.
-- The Edge Function uses the service role after verifying the caller's JWT.
revoke insert, update, delete on public.task_completions from anon, authenticated;
revoke insert, update, delete on public.point_ledger from anon, authenticated;
revoke update on public.profiles from anon, authenticated;
grant select on public.profiles, public.tasks, public.task_completions, public.point_ledger to authenticated;
grant update (username) on public.profiles to authenticated;
grant insert on public.tasks to authenticated;
grant update (title, description, points, active) on public.tasks to authenticated;
