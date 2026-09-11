-- In-app activity center for the web/PWA version. This replaces proactive push
-- with a durable inbox that is refreshed whenever either partner opens the app.
create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (event_type in ('meal', 'reaction', 'comment', 'nudge')),
  meal_id uuid references public.meals(id) on delete cascade,
  body text,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint activity_not_to_self check (actor_id <> recipient_id)
);

create index if not exists activity_recipient_created_idx
  on public.activity_events (recipient_id, created_at desc);
create index if not exists activity_meal_idx
  on public.activity_events (meal_id);

alter table public.activity_events enable row level security;

revoke all on table public.activity_events from anon;
grant select, update on table public.activity_events to authenticated;

drop policy if exists "recipient reads activity" on public.activity_events;
create policy "recipient reads activity"
  on public.activity_events for select
  using (recipient_id = auth.uid());

drop policy if exists "recipient marks activity read" on public.activity_events;
create policy "recipient marks activity read"
  on public.activity_events for update
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

create or replace function public.other_couple_member(target_couple uuid, actor uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select case when c.member_a = actor then c.member_b else c.member_a end
  from public.couples c
  where c.id = target_couple and actor in (c.member_a, c.member_b);
$$;

revoke all on function public.other_couple_member(uuid, uuid) from public;

create or replace function public.activity_from_meal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare recipient uuid;
begin
  recipient := public.other_couple_member(new.couple_id, new.author_id);
  if recipient is not null then
    insert into public.activity_events (couple_id, actor_id, recipient_id, event_type, meal_id, body)
    values (new.couple_id, new.author_id, recipient, 'meal', new.id, coalesce(new.title, '未命名的一顿'));
  end if;
  return new;
end;
$$;

drop trigger if exists meal_activity_event on public.meals;
create trigger meal_activity_event
  after insert on public.meals
  for each row execute function public.activity_from_meal();

revoke all on function public.activity_from_meal() from public;

create or replace function public.activity_from_reaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare target_meal public.meals;
declare recipient uuid;
begin
  if not new.is_active then return new; end if;
  if tg_op = 'UPDATE' and old.is_active then return new; end if;
  select * into target_meal from public.meals where id = new.meal_id;
  -- Reactions belong to the meal author. Do not notify someone when they react
  -- to their own record.
  recipient := target_meal.author_id;
  if recipient = new.user_id then return new; end if;
  if recipient is not null then
    insert into public.activity_events (couple_id, actor_id, recipient_id, event_type, meal_id, body)
    values (target_meal.couple_id, new.user_id, recipient, 'reaction', new.meal_id, new.emoji || ' ' || new.label);
  end if;
  return new;
end;
$$;

drop trigger if exists reaction_activity_event on public.reactions;
create trigger reaction_activity_event
  after insert or update of is_active on public.reactions
  for each row execute function public.activity_from_reaction();

revoke all on function public.activity_from_reaction() from public;

create or replace function public.activity_from_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare target_meal public.meals;
declare recipient uuid;
begin
  select * into target_meal from public.meals where id = new.meal_id;
  -- Comments belong to the meal author. Do not create a self-notification.
  recipient := target_meal.author_id;
  if recipient = new.user_id then return new; end if;
  if recipient is not null then
    insert into public.activity_events (couple_id, actor_id, recipient_id, event_type, meal_id, body)
    values (target_meal.couple_id, new.user_id, recipient, 'comment', new.meal_id, left(new.body, 120));
  end if;
  return new;
end;
$$;

drop trigger if exists comment_activity_event on public.comments;
create trigger comment_activity_event
  after insert on public.comments
  for each row execute function public.activity_from_comment();

revoke all on function public.activity_from_comment() from public;

create or replace function public.send_couple_nudge(target_couple uuid)
returns public.activity_events
language plpgsql
security definer
set search_path = public
as $$
declare actor uuid := auth.uid();
declare recipient uuid;
declare created public.activity_events;
begin
  if actor is null then raise exception '请先登录'; end if;
  recipient := public.other_couple_member(target_couple, actor);
  if recipient is null then raise exception '没有找到可以提醒的伴侣'; end if;

  insert into public.activity_events (couple_id, actor_id, recipient_id, event_type, body)
  values (target_couple, actor, recipient, 'nudge', '记得好好吃饭呀～')
  returning * into created;
  return created;
end;
$$;

revoke all on function public.send_couple_nudge(uuid) from public;
grant execute on function public.send_couple_nudge(uuid) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'activity_events'
  ) then
    alter publication supabase_realtime add table public.activity_events;
  end if;
end;
$$;
