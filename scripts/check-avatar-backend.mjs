import { readFile } from 'node:fs/promises';

const envText = await readFile(new URL('../.env', import.meta.url), 'utf8');
const value = (name) => envText.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1]?.trim();
const base = value('EXPO_PUBLIC_SUPABASE_URL');
const key = value('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
if (!base || !key) throw new Error('Supabase public configuration is missing.');
const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

const permissionResponse = await fetch(`${base}/rest/v1/rpc/can_view_profile`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ target_profile: '00000000-0000-0000-0000-000000000000' }),
});
const permissionBody = await permissionResponse.text();
const permission = /PGRST202|Could not find the function/i.test(permissionBody) ? 'missing' : 'present';

const bucketResponse = await fetch(`${base}/storage/v1/object/list/profile-avatars`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ prefix: '', limit: 1, offset: 0 }),
});
const bucketBody = await bucketResponse.text();
const bucket = /bucket not found|not_found/i.test(bucketBody) && bucketResponse.status === 404 ? 'missing' : 'present';

console.log(JSON.stringify({ privateAvatarBucket: bucket, profileVisibilityFunction: permission }));
if (bucket === 'missing' || permission === 'missing') process.exitCode = 1;
