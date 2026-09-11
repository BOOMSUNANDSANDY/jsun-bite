import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const secretFile = resolve(root, '.supabase-cli.env');
const migrationFile = resolve(root, 'supabase/migrations/20260901000000_initial_schema.sql');
const inviteFixFile = resolve(root, 'supabase/migrations/20260902000000_fix_invite_code_generator.sql');

const envText = await readFile(secretFile, 'utf8');
const token = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m)?.[1]?.trim();
const webhookSecret = envText.match(/^MEAL_WEBHOOK_SECRET=(.+)$/m)?.[1]?.trim();
const projectRef = process.env.SUPABASE_PROJECT_REF
  ?? envText.match(/^SUPABASE_PROJECT_REF=(.+)$/m)?.[1]?.trim();

if (!token) {
  throw new Error('Missing SUPABASE_ACCESS_TOKEN in .supabase-cli.env');
}
if (!projectRef) {
  throw new Error('Missing SUPABASE_PROJECT_REF in .supabase-cli.env');
}

async function query(sql, readOnly = false) {
  const suffix = readOnly ? '/read-only' : '';
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query${suffix}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql, read_only: readOnly }),
    },
  );

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase Management API ${response.status}: ${body}`);
  }

  return body ? JSON.parse(body) : null;
}

async function authConfig(method = 'GET', body) {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/config/auth`,
    {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    },
  );

  const responseBody = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase Auth config API ${response.status}: ${responseBody}`);
  }
  return responseBody ? JSON.parse(responseBody) : null;
}

const command = process.argv[2] ?? 'check';

if (command === 'check') {
  const result = await query(
    `select
       to_regclass('public.profiles')::text as profiles,
       to_regclass('public.meals')::text as meals,
       to_regclass('public.comments')::text as comments;`,
    true,
  );
  console.log(JSON.stringify(result));
} else if (command === 'deploy') {
  const migration = await readFile(migrationFile, 'utf8');
  const migrationHistory = `

create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);
insert into supabase_migrations.schema_migrations (version, statements, name)
values ('20260901000000', array[]::text[], 'initial_schema')
on conflict (version) do nothing;
`;

  await query(`${migration}\n${migrationHistory}`);
  console.log('Initial schema deployed.');
} else if (command === 'fix-invite') {
  const migration = await readFile(inviteFixFile, 'utf8');
  await query(migration);
  const verification = await query(
    `select pg_get_functiondef('public.create_couple_invite()'::regprocedure) like '%extensions.gen_random_bytes%' as fixed;`,
    true,
  );
  console.log(JSON.stringify(verification));
} else if (command === 'webhook') {
  if (!webhookSecret || !/^[a-f0-9]{64}$/.test(webhookSecret)) {
    throw new Error('Missing or invalid MEAL_WEBHOOK_SECRET in .supabase-cli.env');
  }

  const webhookSql = `
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

do $$
declare
  secret_id uuid;
begin
  select id into secret_id from vault.secrets where name = 'meal_push_webhook_secret' limit 1;
  if secret_id is null then
    perform vault.create_secret(
      '${webhookSecret}',
      'meal_push_webhook_secret',
      'Authenticates the meals INSERT trigger to the meal-push Edge Function'
    );
  else
    perform vault.update_secret(
      secret_id,
      '${webhookSecret}',
      'meal_push_webhook_secret',
      'Authenticates the meals INSERT trigger to the meal-push Edge Function'
    );
  end if;
end;
$$;

create or replace function public.notify_meal_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  webhook_secret text;
begin
  select decrypted_secret into webhook_secret
  from vault.decrypted_secrets
  where name = 'meal_push_webhook_secret'
  limit 1;

  perform net.http_post(
    url := 'https://${projectRef}.supabase.co/functions/v1/meal-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', webhook_secret
    ),
    body := jsonb_build_object(
      'type', tg_op,
      'table', tg_table_name,
      'schema', tg_table_schema,
      'record', to_jsonb(new),
      'old_record', null
    ),
    timeout_milliseconds := 3000
  );
  return new;
end;
$$;

revoke all on function public.notify_meal_insert() from public;
drop trigger if exists meal_push_webhook on public.meals;
create trigger meal_push_webhook
  after insert on public.meals
  for each row execute function public.notify_meal_insert();
`;

  await query(webhookSql);
  console.log('Secure meal push webhook configured.');
} else if (command === 'verify') {
  const result = await query(
    `select
       exists (
         select 1 from pg_catalog.pg_trigger
         where tgname = 'meal_push_webhook' and not tgisinternal
       ) as meal_push_trigger,
       exists (
         select 1 from storage.buckets
         where id = 'meal-photos' and public = false
       ) as private_photo_bucket,
       exists (
         select 1 from pg_catalog.pg_policies
         where schemaname = 'public' and tablename = 'meals'
       ) as meal_rls_policies,
       exists (
         select 1
         from pg_catalog.pg_publication_tables
         where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'meals'
       ) as meals_realtime;`,
    true,
  );
  console.log(JSON.stringify(result));
} else if (command === 'auth-url') {
  const hostedUrl = 'https://jsun-bite.expo.app';
  const current = await authConfig();
  const allowed = String(current?.uri_allow_list ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  for (const url of [hostedUrl, `${hostedUrl}/**`]) {
    if (!allowed.includes(url)) allowed.push(url);
  }

  const updated = await authConfig('PATCH', {
    site_url: hostedUrl,
    uri_allow_list: allowed.join(','),
  });
  console.log(JSON.stringify({
    siteUrl: updated?.site_url,
    hostedUrlAllowed: String(updated?.uri_allow_list ?? '').includes(hostedUrl),
  }));
} else {
  throw new Error(`Unknown command: ${command}`);
}
