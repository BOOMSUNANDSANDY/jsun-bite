-- Fix partner profile visibility. The original policy used an unqualified `id`
-- inside the couples subquery, so PostgreSQL compared couples.id instead of the
-- outer profiles.id and only the signed-in user's own profile was visible.
drop policy if exists "profiles visible to self and partner" on public.profiles;

create policy "profiles visible to self and partner"
on public.profiles
for select
using (
  profiles.id = auth.uid()
  or exists (
    select 1
    from public.couples c
    where auth.uid() in (c.member_a, c.member_b)
      and profiles.id in (c.member_a, c.member_b)
  )
);
