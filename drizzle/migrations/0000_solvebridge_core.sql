
create type public.app_role as enum ('admin', 'solver');
create type public.problem_status as enum ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'RESOLVED', 'ARCHIVED');
create type public.solution_status as enum ('SUBMITTED', 'ACCEPTED', 'REJECTED', 'CHANGES_REQUESTED');

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text check (full_name is null or char_length(full_name) <= 100),
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 500),
  bio text check (bio is null or char_length(bio) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select (id, full_name, avatar_url) on public.profiles to anon;
grant select, update (full_name, avatar_url, bio) on public.profiles to authenticated;
grant select on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "Users read own profile" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "Users update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();

-- user roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "Users read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;

-- categories
create table public.problem_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 2 and 60),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text check (description is null or char_length(description) <= 300),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.problem_categories to anon, authenticated;
grant all on public.problem_categories to service_role;
alter table public.problem_categories enable row level security;
create policy "Active categories are public" on public.problem_categories for select to anon, authenticated using (is_active = true);

insert into public.problem_categories (name, slug, description) values
  ('Education', 'education', 'Learning, schools, access to knowledge'),
  ('Health', 'health', 'Healthcare, wellbeing, medical access'),
  ('Environment', 'environment', 'Pollution, waste, climate, nature'),
  ('Agriculture', 'agriculture', 'Farming, food production, livestock'),
  ('Transportation', 'transportation', 'Roads, traffic, mobility'),
  ('Water & Sanitation', 'water-sanitation', 'Clean water, drainage, hygiene'),
  ('Energy', 'energy', 'Electricity, power access, efficiency'),
  ('Technology', 'technology', 'Digital tools, connectivity, software'),
  ('Community', 'community', 'Local services, safety, public spaces'),
  ('Other', 'other', 'Anything that does not fit elsewhere');

-- problems
create table public.problems (
  id uuid primary key default gen_random_uuid(),
  reference_id text not null unique,
  title text not null check (char_length(title) between 5 and 150),
  description text not null check (char_length(description) between 20 and 5000),
  category_id uuid not null references public.problem_categories(id),
  location text check (location is null or char_length(location) <= 150),
  contact_email text check (contact_email is null or char_length(contact_email) <= 255),
  additional_info text check (additional_info is null or char_length(additional_info) <= 2000),
  status public.problem_status not null default 'PENDING_REVIEW',
  submitter_user_id uuid,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  updated_at timestamptz not null default now()
);
create index problems_status_idx on public.problems (status, created_at desc);
create index problems_category_idx on public.problems (category_id);
create index problems_submitter_idx on public.problems (submitter_user_id);
grant select (id, reference_id, title, description, category_id, location, additional_info, status, created_at, published_at, updated_at)
  on public.problems to anon, authenticated;
grant all on public.problems to service_role;
alter table public.problems enable row level security;
create policy "Published problems are public" on public.problems for select to anon, authenticated
  using (status in ('APPROVED', 'RESOLVED'));
create trigger problems_updated_at before update on public.problems for each row execute function public.set_updated_at();

-- claim keys (digest only, server access only)
create table public.problem_claims (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null unique references public.problems(id) on delete cascade,
  token_hash text not null,
  claimed_by uuid,
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);
grant all on public.problem_claims to service_role;
alter table public.problem_claims enable row level security;

-- selections
create table public.problem_selections (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references public.problems(id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  unique (problem_id, user_id)
);
create index problem_selections_user_idx on public.problem_selections (user_id);
grant select, insert (problem_id, user_id), update (withdrawn_at) on public.problem_selections to authenticated;
grant all on public.problem_selections to service_role;
alter table public.problem_selections enable row level security;
create policy "Solvers read own selections" on public.problem_selections for select to authenticated using (user_id = auth.uid());
create policy "Solvers select approved problems" on public.problem_selections for insert to authenticated
  with check (user_id = auth.uid() and withdrawn_at is null
    and exists (select 1 from public.problems p where p.id = problem_id and p.status = 'APPROVED'));
create policy "Solvers update own selections" on public.problem_selections for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and (withdrawn_at is not null
    or exists (select 1 from public.problems p where p.id = problem_id and p.status = 'APPROVED')));

create or replace function public.active_solver_counts(_problem_ids uuid[])
returns table (problem_id uuid, solver_count bigint)
language sql stable security definer set search_path = public as $$
  select s.problem_id, count(*)::bigint
  from public.problem_selections s
  join public.problems p on p.id = s.problem_id
  where s.problem_id = any(_problem_ids)
    and s.withdrawn_at is null
    and p.status in ('APPROVED', 'RESOLVED')
  group by s.problem_id
$$;
grant execute on function public.active_solver_counts(uuid[]) to anon, authenticated, service_role;

-- solutions
create table public.solutions (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references public.problems(id) on delete cascade,
  submitted_by uuid not null,
  title text not null check (char_length(title) between 5 and 150),
  description text not null check (char_length(description) between 20 and 10000),
  solution_type text not null check (solution_type in ('SOFTWARE', 'HARDWARE', 'RESEARCH', 'DESIGN', 'PROCESS', 'OTHER')),
  github_url text check (github_url is null or (char_length(github_url) <= 500 and github_url ~ '^https://')),
  demo_url text check (demo_url is null or (char_length(demo_url) <= 500 and demo_url ~ '^https://')),
  status public.solution_status not null default 'SUBMITTED',
  admin_feedback text check (admin_feedback is null or char_length(admin_feedback) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create unique index solutions_one_active_per_solver on public.solutions (problem_id, submitted_by) where status <> 'REJECTED';
create index solutions_status_idx on public.solutions (status, created_at desc);
create index solutions_submitted_by_idx on public.solutions (submitted_by);
grant select (id, problem_id, submitted_by, title, description, solution_type, github_url, demo_url, status, created_at, updated_at, reviewed_at)
  on public.solutions to anon;
grant select, insert (problem_id, submitted_by, title, description, solution_type, github_url, demo_url),
  update (title, description, solution_type, github_url, demo_url, status) on public.solutions to authenticated;
grant all on public.solutions to service_role;
alter table public.solutions enable row level security;
create policy "Accepted solutions are public" on public.solutions for select to anon
  using (status = 'ACCEPTED' and exists (select 1 from public.problems p where p.id = problem_id and p.status in ('APPROVED', 'RESOLVED')));
create policy "Solvers read own solutions" on public.solutions for select to authenticated using (submitted_by = auth.uid());
create policy "Solvers submit for selected problems" on public.solutions for insert to authenticated
  with check (submitted_by = auth.uid()
    and exists (select 1 from public.problem_selections s where s.problem_id = solutions.problem_id and s.user_id = auth.uid() and s.withdrawn_at is null)
    and exists (select 1 from public.problems p where p.id = solutions.problem_id and p.status = 'APPROVED'));
create policy "Solvers resubmit after change request" on public.solutions for update to authenticated
  using (submitted_by = auth.uid() and status = 'CHANGES_REQUESTED')
  with check (submitted_by = auth.uid() and status = 'SUBMITTED');

create or replace function public.guard_solution_write()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.status := 'SUBMITTED';
    new.admin_feedback := null;
    new.reviewed_at := null;
  else
    new.problem_id := old.problem_id;
    new.submitted_by := old.submitted_by;
    new.admin_feedback := old.admin_feedback;
    new.reviewed_at := old.reviewed_at;
    new.status := 'SUBMITTED';
  end if;
  return new;
end $$;
create trigger solutions_guard before insert or update on public.solutions for each row execute function public.guard_solution_write();
create trigger solutions_updated_at before update on public.solutions for each row execute function public.set_updated_at();

-- public author names for accepted solutions
create policy "Authors of accepted solutions are public" on public.profiles for select to anon
  using (exists (select 1 from public.solutions s where s.submitted_by = profiles.id and s.status = 'ACCEPTED'));

-- media
create table public.problem_media (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references public.problems(id) on delete cascade,
  file_path text not null unique,
  file_type text not null,
  created_at timestamptz not null default now()
);
create index problem_media_problem_idx on public.problem_media (problem_id);
grant select on public.problem_media to anon, authenticated;
grant all on public.problem_media to service_role;
alter table public.problem_media enable row level security;
create policy "Media of published problems is viewable" on public.problem_media for select to anon, authenticated
  using (exists (select 1 from public.problems p where p.id = problem_id and p.status in ('APPROVED', 'RESOLVED')));

create table public.solution_media (
  id uuid primary key default gen_random_uuid(),
  solution_id uuid not null references public.solutions(id) on delete cascade,
  file_path text not null unique,
  file_type text not null,
  created_at timestamptz not null default now()
);
create index solution_media_solution_idx on public.solution_media (solution_id);
grant select on public.solution_media to anon, authenticated;
grant all on public.solution_media to service_role;
alter table public.solution_media enable row level security;
create policy "Media of accepted solutions is viewable" on public.solution_media for select to anon
  using (exists (select 1 from public.solutions s where s.id = solution_id and s.status = 'ACCEPTED'));
create policy "Solvers view own solution media" on public.solution_media for select to authenticated
  using (exists (select 1 from public.solutions s where s.id = solution_id and s.submitted_by = auth.uid()));

-- audit log
create table public.admin_reviews (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null,
  target_type text not null check (target_type in ('problem', 'solution', 'user', 'category')),
  target_id uuid not null,
  action text not null check (char_length(action) <= 60),
  feedback text check (feedback is null or char_length(feedback) <= 2000),
  created_at timestamptz not null default now()
);
create index admin_reviews_created_idx on public.admin_reviews (created_at desc);
grant all on public.admin_reviews to service_role;
alter table public.admin_reviews enable row level security;

-- rate limits
create table public.rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  count integer not null default 0
);
grant all on public.rate_limits to service_role;
alter table public.rate_limits enable row level security;

create or replace function public.check_rate_limit(_key text, _max integer, _window_seconds integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare c integer;
begin
  insert into public.rate_limits as r (key, window_start, count) values (_key, now(), 1)
  on conflict (key) do update set
    count = case when r.window_start < now() - make_interval(secs => _window_seconds) then 1 else r.count + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => _window_seconds) then now() else r.window_start end
  returning count into c;
  return c <= _max;
end $$;
revoke execute on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;

-- problems a signed-in user has claimed (includes pending ones)
create or replace function public.my_claimed_problems()
returns table (id uuid, reference_id text, title text, status public.problem_status, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.reference_id, p.title, p.status, p.created_at
  from public.problems p
  where p.submitter_user_id = auth.uid() and auth.uid() is not null
  order by p.created_at desc
$$;
revoke execute on function public.my_claimed_problems() from public, anon;
grant execute on function public.my_claimed_problems() to authenticated;

-- new users: profile + solver role
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id,
    left(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'), 100),
    left(new.raw_user_meta_data->>'avatar_url', 500))
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'solver') on conflict do nothing;
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
