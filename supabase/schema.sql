-- Carrier GreenON Supabase 스키마
-- 새 Supabase 프로젝트의 SQL Editor에서 한 번 실행합니다.
-- public 테이블은 명시적 GRANT + RLS 정책을 한 단위로 적용합니다.

begin;

create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'GreenON 사용자'
    check (char_length(display_name) between 1 and 40),
  green_level text not null default 'seed'
    check (green_level in ('seed', 'leaf', 'tree')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.missions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text not null,
  required_minutes integer not null check (required_minutes > 0),
  min_temperature numeric(4,1) not null default 26
    check (min_temperature between 16 and 32),
  reward_points integer not null check (reward_points > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.user_missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references public.profiles(id) on delete cascade,
  mission_id uuid not null
    references public.missions(id) on delete restrict,
  mission_date date not null default current_date,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'success', 'failed')),
  progress_minutes integer not null default 0
    check (progress_minutes >= 0),
  warning text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, mission_id, mission_date)
);

create table public.point_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null
    references public.profiles(id) on delete cascade,
  amount integer not null check (amount <> 0),
  transaction_type text not null
    check (transaction_type in ('mission_reward', 'reward_purchase', 'adjustment')),
  title text not null,
  reference_type text
    check (reference_type in ('user_mission', 'reward_order') or reference_type is null),
  reference_id uuid,
  created_at timestamptz not null default now()
);

create unique index point_transactions_reference_unique
  on public.point_transactions (user_id, reference_type, reference_id)
  where reference_id is not null;
create index point_transactions_user_created_idx
  on public.point_transactions (user_id, created_at desc);

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  category text not null check (category in ('FOOD', 'LIFE', 'CARRIER')),
  name text not null,
  description text not null,
  icon text not null,
  price integer not null check (price > 0),
  stock integer check (stock is null or stock >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.reward_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null
    references public.profiles(id) on delete cascade,
  reward_id uuid not null
    references public.rewards(id) on delete restrict,
  point_price integer not null check (point_price > 0),
  status text not null default 'completed'
    check (status in ('completed', 'cancelled')),
  purchased_at timestamptz not null default now()
);

create index reward_orders_user_id_idx on public.reward_orders (user_id);
create index reward_orders_reward_id_idx on public.reward_orders (reward_id);
create index user_missions_mission_id_idx on public.user_missions (mission_id);

create table public.aircon_status (
  user_id uuid primary key
    references public.profiles(id) on delete cascade,
  power boolean not null default true,
  mode text not null default 'cool'
    check (mode in ('cool', 'fan', 'dry', 'auto')),
  set_temperature numeric(4,1) not null default 26
    check (set_temperature between 16 and 32),
  fan text not null default 'auto'
    check (fan in ('low', 'medium', 'high', 'auto')),
  usage_minutes integer not null default 0
    check (usage_minutes >= 0),
  filter_status text not null default 'clean'
    check (filter_status in ('clean', 'needs_check')),
  sensor_status text not null default 'normal'
    check (sensor_status in ('normal', 'error')),
  issue text,
  updated_at timestamptz not null default now()
);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger aircon_status_set_updated_at
before update on public.aircon_status
for each row execute function private.set_updated_at();

-- 가입 시 프로필과 가상 에어컨 행을 자동 생성합니다.
-- display_name은 화면 표시용이며 권한 판단에는 사용하지 않습니다.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      split_part(coalesce(new.email, 'GreenON 사용자'), '@', 1)
    )
  )
  on conflict (id) do nothing;

  insert into public.aircon_status (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create or replace function private.update_green_level()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  lifetime_points integer;
begin
  select coalesce(sum(amount), 0)::integer
    into lifetime_points
  from public.point_transactions
  where user_id = new.user_id
    and amount > 0;

  update public.profiles
  set green_level = case
    when lifetime_points >= 500 then 'tree'
    when lifetime_points >= 200 then 'leaf'
    else 'seed'
  end
  where id = new.user_id;

  return new;
end;
$$;

create trigger point_transactions_update_level
after insert on public.point_transactions
for each row execute function private.update_green_level();

alter table public.profiles enable row level security;
alter table public.missions enable row level security;
alter table public.user_missions enable row level security;
alter table public.point_transactions enable row level security;
alter table public.rewards enable row level security;
alter table public.reward_orders enable row level security;
alter table public.aircon_status enable row level security;

create policy "profiles_select_own" on public.profiles
for select to authenticated
using ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles
for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "missions_read_active" on public.missions
for select to anon, authenticated
using (active);

create policy "user_missions_select_own" on public.user_missions
for select to authenticated
using ((select auth.uid()) = user_id);
create policy "user_missions_insert_own" on public.user_missions
for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "point_transactions_select_own"
on public.point_transactions
for select to authenticated
using ((select auth.uid()) = user_id);

create policy "rewards_read_active" on public.rewards
for select to anon, authenticated
using (active);

create policy "reward_orders_select_own" on public.reward_orders
for select to authenticated
using ((select auth.uid()) = user_id);

create policy "aircon_status_select_own" on public.aircon_status
for select to authenticated
using ((select auth.uid()) = user_id);
create policy "aircon_status_insert_own" on public.aircon_status
for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "aircon_status_update_own" on public.aircon_status
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- 2026 Data API 기본 권한 변경에 대비해 모든 권한을 명시합니다.
revoke all on
  public.profiles,
  public.missions,
  public.user_missions,
  public.point_transactions,
  public.rewards,
  public.reward_orders,
  public.aircon_status
from anon, authenticated;

grant select on public.missions, public.rewards to anon, authenticated;
grant select, update (display_name) on public.profiles to authenticated;
grant select on public.user_missions to authenticated;
grant select on public.point_transactions, public.reward_orders to authenticated;
grant select, insert,
  update (power, mode, set_temperature, fan, usage_minutes, filter_status, sensor_status, issue)
on public.aircon_status to authenticated;

-- 실제 쓰기 로직은 비노출 private 스키마에서 소유자와 조건을 다시 검사합니다.
create or replace function private.start_green_mission(p_mission_id uuid)
returns table (
  user_mission_id uuid,
  mission_status text,
  progress_minutes integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  result_row public.user_missions%rowtype;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;

  if not exists (
    select 1 from public.missions
    where id = p_mission_id and active
  ) then
    raise exception using errcode = 'P0001', message = 'MISSION_NOT_AVAILABLE';
  end if;

  insert into public.user_missions (
    user_id, mission_id, mission_date, status,
    progress_minutes, warning, started_at, completed_at
  )
  values (
    caller_id, p_mission_id, current_date, 'in_progress',
    0, null, now(), null
  )
  on conflict (user_id, mission_id, mission_date)
  do update set
    status = 'in_progress',
    progress_minutes = 0,
    warning = null,
    started_at = now(),
    completed_at = null
  returning * into result_row;

  return query
  select result_row.id, result_row.status, result_row.progress_minutes;
end;
$$;

create or replace function private.advance_green_mission(p_user_mission_id uuid)
returns table (
  mission_status text,
  progress_minutes integer,
  points_awarded integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  participant public.user_missions%rowtype;
  mission_row public.missions%rowtype;
  aircon_row public.aircon_status%rowtype;
  next_progress integer;
  inserted_count integer := 0;
  failure_reason text;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;

  select * into participant
  from public.user_missions
  where id = p_user_mission_id
    and user_id = caller_id
  for update;

  if not found then
    raise exception using errcode = '42501',
      message = 'MISSION_NOT_FOUND_OR_FORBIDDEN';
  end if;

  if participant.status <> 'in_progress' then
    return query
    select participant.status, participant.progress_minutes, 0;
    return;
  end if;

  select * into mission_row
  from public.missions
  where id = participant.mission_id and active;

  select * into aircon_row
  from public.aircon_status
  where user_id = caller_id;

  if not found then
    failure_reason := 'AIRCON_STATUS_NOT_FOUND';
  elsif not aircon_row.power then
    failure_reason := 'POWER_OFF';
  elsif aircon_row.mode <> 'cool' then
    failure_reason := 'MODE_VIOLATION';
  elsif aircon_row.set_temperature < mission_row.min_temperature then
    failure_reason := 'TEMPERATURE_VIOLATION';
  elsif aircon_row.issue is not null
    or aircon_row.filter_status <> 'clean'
    or aircon_row.sensor_status <> 'normal' then
    failure_reason := 'DEVICE_ERROR';
  end if;

  if failure_reason is not null then
    update public.user_missions
    set status = 'failed',
        warning = failure_reason,
        completed_at = now()
    where id = participant.id;

    return query
    select 'failed'::text, participant.progress_minutes, 0;
    return;
  end if;

  next_progress := least(
    participant.progress_minutes + 30,
    mission_row.required_minutes
  );

  update public.aircon_status
  set usage_minutes = usage_minutes + 30
  where user_id = caller_id;

  if next_progress >= mission_row.required_minutes then
    update public.user_missions
    set status = 'success',
        progress_minutes = next_progress,
        warning = null,
        completed_at = now()
    where id = participant.id;

    insert into public.point_transactions (
      user_id, amount, transaction_type, title,
      reference_type, reference_id
    )
    values (
      caller_id, mission_row.reward_points, 'mission_reward',
      mission_row.title, 'user_mission', participant.id
    )
    on conflict (user_id, reference_type, reference_id)
      where reference_id is not null
    do nothing;
    get diagnostics inserted_count = row_count;

    return query
    select
      'success'::text,
      next_progress,
      case when inserted_count = 1
        then mission_row.reward_points else 0 end;
  else
    update public.user_missions
    set progress_minutes = next_progress,
        warning = null
    where id = participant.id;

    return query
    select 'in_progress'::text, next_progress, 0;
  end if;
end;
$$;

create or replace function private.purchase_reward(p_reward_id uuid)
returns table (order_id uuid, remaining_balance integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  reward_row public.rewards%rowtype;
  current_balance integer;
  created_order_id uuid;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(caller_id::text, 0)
  );

  select * into reward_row
  from public.rewards
  where id = p_reward_id
    and active
    and (stock is null or stock > 0)
  for update;

  if not found then
    raise exception using errcode = 'P0001',
      message = 'REWARD_NOT_AVAILABLE';
  end if;

  select coalesce(sum(amount), 0)::integer
    into current_balance
  from public.point_transactions
  where user_id = caller_id;

  if current_balance < reward_row.price then
    raise exception using errcode = 'P0001',
      message = 'INSUFFICIENT_POINTS';
  end if;

  insert into public.reward_orders (user_id, reward_id, point_price)
  values (caller_id, reward_row.id, reward_row.price)
  returning id into created_order_id;

  insert into public.point_transactions (
    user_id, amount, transaction_type, title,
    reference_type, reference_id
  )
  values (
    caller_id, -reward_row.price, 'reward_purchase',
    reward_row.name, 'reward_order', created_order_id
  );

  if reward_row.stock is not null then
    update public.rewards
    set stock = stock - 1
    where id = reward_row.id;
  end if;

  return query
  select created_order_id, current_balance - reward_row.price;
end;
$$;

revoke all on function private.start_green_mission(uuid) from public, anon;
revoke all on function private.advance_green_mission(uuid) from public, anon;
revoke all on function private.purchase_reward(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.start_green_mission(uuid) to authenticated;
grant execute on function private.advance_green_mission(uuid) to authenticated;
grant execute on function private.purchase_reward(uuid) to authenticated;

-- Data API에 노출되는 함수는 권한 상승이 없는 얇은 래퍼입니다.
create or replace function public.start_green_mission(p_mission_id uuid)
returns table (
  user_mission_id uuid,
  mission_status text,
  progress_minutes integer
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.start_green_mission(p_mission_id);
$$;

create or replace function public.advance_green_mission(p_user_mission_id uuid)
returns table (
  mission_status text,
  progress_minutes integer,
  points_awarded integer
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.advance_green_mission(p_user_mission_id);
$$;

create or replace function public.purchase_reward(p_reward_id uuid)
returns table (order_id uuid, remaining_balance integer)
language sql
security invoker
set search_path = ''
as $$
  select * from private.purchase_reward(p_reward_id);
$$;

revoke all on function public.start_green_mission(uuid) from public, anon;
revoke all on function public.advance_green_mission(uuid) from public, anon;
revoke all on function public.purchase_reward(uuid) from public, anon;
grant execute on function public.start_green_mission(uuid) to authenticated;
grant execute on function public.advance_green_mission(uuid) to authenticated;
grant execute on function public.purchase_reward(uuid) to authenticated;

insert into public.missions (
  code, title, description,
  required_minutes, min_temperature, reward_points
)
values (
  'eco-cooling-26',
  '26°C 절전 냉방 지키기',
  '설정 온도를 26°C 이상으로 유지하며 2시간 동안 냉방해요.',
  120, 26, 120
);

insert into public.rewards (
  code, category, name, description, icon, price, stock
)
values
  ('reward-coffee', 'FOOD', '다회용 컵 음료 쿠폰', '개인 다회용 컵 사용 시 즐길 수 있는 친환경 음료 교환 쿠폰이에요.', '☕', 80, null),
  ('reward-snack', 'FOOD', '저탄소 간식 세트', '환경을 생각한 포장과 원료로 만든 가벼운 간식 세트예요.', '🍪', 150, null),
  ('reward-towel', 'LIFE', '업사이클 미니 타월', '버려지는 원단을 다시 활용해 만든 부드러운 미니 타월이에요.', '🧺', 110, null),
  ('reward-bag', 'LIFE', 'GreenON 에코백', '장보기와 일상에서 오래 사용할 수 있는 튼튼한 GreenON 에코백이에요.', '🛍️', 220, null),
  ('reward-filter', 'CARRIER', '캐리어 필터 케어 쿠폰', '깨끗하고 효율적인 냉방을 위한 가상 필터 케어 서비스 쿠폰이에요.', '❄️', 300, null),
  ('reward-sticker', 'CARRIER', 'GreenON 스티커 팩', '에어컨과 다이어리를 꾸밀 수 있는 친환경 GreenON 스티커 팩이에요.', '🌿', 60, null);

commit;
