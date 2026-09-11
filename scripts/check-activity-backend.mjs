import { readFile } from 'node:fs/promises';

const envText = await readFile(new URL('../.env', import.meta.url), 'utf8');
const value = (name) => envText.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1]?.trim();
const base = value('EXPO_PUBLIC_SUPABASE_URL');
const key = value('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
if (!base || !key) throw new Error('Supabase public configuration is missing.');

const response = await fetch(`${base}/rest/v1/rpc/send_couple_nudge`, {
  method: 'POST',
  headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ target_couple: '00000000-0000-0000-0000-000000000000' }),
});
const body = await response.text();
if (/PGRST202|Could not find the function/i.test(body)) {
  console.log(JSON.stringify({ activityBackend: 'missing', status: response.status }));
  process.exitCode = 1;
} else if (/permission denied|请先登录|JWT/i.test(body) || response.status === 401 || response.status === 403) {
  console.log(JSON.stringify({ activityBackend: 'present', unauthenticatedProbeBlocked: true, status: response.status }));
} else {
  console.log(JSON.stringify({ activityBackend: 'unexpected', status: response.status, response: body.slice(0, 160) }));
  process.exitCode = 1;
}
