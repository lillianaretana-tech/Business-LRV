create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  country text not null,
  city text,
  age_range text,
  budget_usd numeric(12,2) not null check (budget_usd >= 0),
  monthly_goal_usd numeric(12,2) check (monthly_goal_usd >= 0),
  weekly_hours int not null check (weekly_hours between 1 and 100),
  situation text,
  education text,
  experience text,
  income_mode text,
  preferred_format text,
  risk_tolerance text,
  sales_comfort text,
  work_preference text,
  guidance_mode text default 'starter',
  interests text[] default '{}',
  skills text[] default '{}',
  devices text[] default '{}',
  consent_ai boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  category text not null,
  countries text[] default '{}',
  content jsonb not null,
  editorial_status text not null default 'draft',
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.evidence (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references public.opportunities(id) on delete cascade,
  country text,
  source_title text not null,
  source_url text not null,
  published_on date,
  checked_at timestamptz not null default now(),
  expires_at timestamptz,
  confidence numeric(3,2) check (confidence between 0 and 1),
  summary text not null
);

create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id),
  score int not null check (score between 0 and 100),
  scoring jsonb not null,
  recommendation jsonb not null,
  evidence_ids uuid[] default '{}',
  prompt_version text,
  created_at timestamptz not null default now()
);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recommendation_id uuid references public.recommendations(id),
  horizon_days int not null check (horizon_days in (30, 90)),
  content jsonb not null,
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  due_on date,
  status text not null default 'pending',
  metric jsonb,
  completed_at timestamptz
);

create table public.financial_scenarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recommendation_id uuid references public.recommendations(id),
  assumptions jsonb not null,
  projection jsonb not null,
  created_at timestamptz not null default now()
);

create table public.favorites (
  user_id uuid references auth.users(id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, opportunity_id)
);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  content jsonb not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.recommendations enable row level security;
alter table public.plans enable row level security;
alter table public.tasks enable row level security;
alter table public.financial_scenarios enable row level security;
alter table public.favorites enable row level security;
alter table public.alerts enable row level security;

create policy "profiles owned by user" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "recommendations owned by user" on public.recommendations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "plans owned by user" on public.plans for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "tasks owned by user" on public.tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "scenarios owned by user" on public.financial_scenarios for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "favorites owned by user" on public.favorites for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "alerts owned by user" on public.alerts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
