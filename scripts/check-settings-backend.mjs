import { readFile } from 'node:fs/promises';

const envText = await readFile(new URL('../.env', import.meta.url), 'utf8');
const value = (name) => envText.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1]?.trim();
const base = value('EXPO_PUBLIC_SUPABASE_URL');
const key = value('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
if (!base || !key) throw new Error('Supabase public configuration is missing.');

const probes = [
  ['cancel_my_couple_invite', { expected_invite: 'VERIFY0' }],
  ['update_couple_settings', {
    target_couple: '00000000-0000-0000-0000-000000000000',
    new_pet_name: '豆包',
    new_anniversary: null,
  }],
];

const result = {};
for (const [name, payload] of probes) {
  const response = await fetch(`${base}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await response.text();
  result[name] = /PGRST202|Could not find the function/i.test(body) ? 'missing' : 'present';
}

console.log(JSON.stringify(result));
if (Object.values(result).includes('missing')) process.exitCode = 1;
