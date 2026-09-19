-- JobCompass initial schema.
--
-- Two ownership models live here:
--   * user-owned rows (profiles, documents, matches, ...) are readable and
--     writable only by their owner, enforced by RLS on auth.uid();
--   * the job catalogue (companies, jobs) is world-readable but writable only
--     by the service role, because it is populated by the cron poller.

create extension if not exists "pgcrypto";

create type ats_kind          as enum ('greenhouse', 'lever', 'ashby', 'workday');
create type document_kind     as enum ('resume', 'transcript', 'linkedin');
create type application_status as enum ('saved', 'applied', 'interviewing', 'offer', 'rejected');

-- ---------------------------------------------------------------- user data

create table profiles (
  user_id     uuid primary key references auth.users on delete cascade,
  full_name   text,
  school      text,
  grad_date   date,
  work_auth   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table documents (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  kind         document_kind not null,
  storage_path text not null,
  filename     text,
  byte_size    integer,
  parsed_at    timestamptz,
  created_at   timestamptz not null default now(),
  unique (user_id, kind)
);
create index on documents (user_id);

-- The AI-extracted profile. `confirmed_at` is the gate: extraction produces a
-- draft, and nothing downstream may read a row the student has not confirmed.
create table student_profiles (
  user_id      uuid primary key references auth.users on delete cascade,
  skills       text[]      not null default '{}',
  coursework   jsonb       not null default '[]',
  experience   jsonb       not null default '[]',
  projects     jsonb       not null default '[]',
  targets      jsonb       not null default '{}',
  dictation    text,
  confirmed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ----------------------------------------------------------- job catalogue

create table companies (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null,
  ats           ats_kind not null,
  -- Workday only: a board is tenant + host shard + site, and one tenant can
  -- expose several sites (PwC splits campus from experienced hiring).
  workday_host  text,
  workday_site  text,
  sector        text,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (ats, slug, workday_site),
  constraint workday_needs_host_and_site check (
    ats <> 'workday' or (workday_host is not null and workday_site is not null)
  )
);

create table jobs (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references companies on delete cascade,
  ats_job_id        text not null,
  title             text not null,
  location          text,
  description       text,
  apply_url         text not null,
  employment_type   text,
  department        text,
  is_remote         boolean,
  is_entry_level    boolean not null default false,
  -- Authoritative posted date from the source feed. Present on every posting
  -- in all four providers (Workday's needs hydrate()), so "just opened" does
  -- not depend on when we started watching.
  posted_at         timestamptz,
  explicit_deadline timestamptz,
  -- Our own observation window, which is what closure is derived from.
  first_seen        timestamptz not null default now(),
  last_seen         timestamptz not null default now(),
  closed_at         timestamptz,
  hydrated_at       timestamptz,
  created_at        timestamptz not null default now(),
  unique (company_id, ats_job_id)
);
create index on jobs (company_id);
create index on jobs (closed_at) where closed_at is null;
create index on jobs (posted_at desc nulls last);
create index on jobs (is_entry_level) where closed_at is null;

-- Every poll attempt, successful or not. Closure detection reads this: a job
-- may only be closed for a company whose most recent run succeeded.
create table job_poll_runs (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies on delete cascade,
  ran_at     timestamptz not null default now(),
  ok         boolean not null,
  job_count  integer,
  error      text,
  duration_ms integer
);
create index on job_poll_runs (company_id, ran_at desc);

-- --------------------------------------------------------- derived per-user

create table matches (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  job_id       uuid not null references jobs on delete cascade,
  score        integer not null check (score between 0 and 100),
  reasons      jsonb not null default '[]',
  gaps         jsonb not null default '[]',
  dismissed_at timestamptz,
  scored_at    timestamptz not null default now(),
  unique (user_id, job_id)
);
create index on matches (user_id, score desc);

create table tailored_resumes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  job_id     uuid not null references jobs on delete cascade,
  content    jsonb not null,
  changes    jsonb not null default '[]',
  pdf_path   text,
  created_at timestamptz not null default now(),
  unique (user_id, job_id)
);

create table applications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  job_id     uuid not null references jobs on delete cascade,
  status     application_status not null default 'saved',
  applied_at timestamptz,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, job_id)
);
create index on applications (user_id, status);

-- ------------------------------------------------------------------- RLS

alter table profiles         enable row level security;
alter table documents        enable row level security;
alter table student_profiles enable row level security;
alter table matches          enable row level security;
alter table tailored_resumes enable row level security;
alter table applications     enable row level security;
alter table companies        enable row level security;
alter table jobs             enable row level security;
alter table job_poll_runs    enable row level security;

-- Owner-only tables. Split per command so an UPDATE cannot reassign user_id.
do $$
declare t text;
begin
  foreach t in array array['profiles','documents','student_profiles','matches',
                           'tailored_resumes','applications']
  loop
    execute format('create policy %I_select on %I for select using (auth.uid() = user_id)', t, t);
    execute format('create policy %I_insert on %I for insert with check (auth.uid() = user_id)', t, t);
    execute format('create policy %I_update on %I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t, t);
    execute format('create policy %I_delete on %I for delete using (auth.uid() = user_id)', t, t);
  end loop;
end $$;

-- Catalogue: readable by any signed-in user, written only by the poller
-- (service role bypasses RLS, so no write policy is defined at all).
create policy companies_read on companies for select to authenticated using (true);
create policy jobs_read      on jobs      for select to authenticated using (true);
-- job_poll_runs stays operator-only: no policy, so only the service role sees it.

-- --------------------------------------------------------------- triggers

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger profiles_updated        before update on profiles         for each row execute function set_updated_at();
create trigger student_profiles_updated before update on student_profiles for each row execute function set_updated_at();
create trigger applications_updated    before update on applications     for each row execute function set_updated_at();

-- Give every new auth user a profile row so the app never has to upsert one.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (user_id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute function handle_new_user();

-- --------------------------------------------------------------- grants
-- Supabase grants these by default, but stating them keeps the migration
-- self-contained and independent of project bootstrap order.

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on
  profiles, documents, student_profiles, matches, tailored_resumes, applications
  to authenticated;

grant select on companies, jobs to authenticated;

-- job_poll_runs is deliberately omitted: operator data, service role only.
grant all on all tables in schema public to service_role;
