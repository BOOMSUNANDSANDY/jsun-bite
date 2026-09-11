-- Supabase installs pgcrypto in the extensions schema. The function's restricted
-- search_path intentionally excludes that schema, so qualify the call explicitly.
create or replace function public.create_couple_invite()
returns public.couples
language plpgsql
security definer set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  existing public.couples;
  created public.couples;
  next_code text;
begin
  if current_user_id is null then
    raise exception '请先登录';
  end if;

  perform pg_advisory_xact_lock(hashtext(current_user_id::text));

  select * into existing
  from public.couples c
  where current_user_id in (c.member_a, c.member_b)
  limit 1;

  if found then
    return existing;
  end if;

  loop
    next_code := upper(substr(encode(extensions.gen_random_bytes(5), 'hex'), 1, 6));
    begin
      insert into public.couples (member_a, invite_code)
      values (current_user_id, next_code)
      returning * into created;
      exit;
    exception when unique_violation then
      -- Extremely rare code collision; retry inside the same transaction.
    end;
  end loop;

  return created;
end;
$$;

revoke all on function public.create_couple_invite() from public;
grant execute on function public.create_couple_invite() to authenticated;
