import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectRef = process.argv[2];
const slug = process.argv[3];
const localEnv = await readFile(resolve(import.meta.dirname, '..', '.supabase-cli.env'), 'utf8').catch(() => '');
const localTokenLine = localEnv.split(/\r?\n/)
  .map((line) => line.replace(/^\uFEFF/, ''))
  .find((line) => line.startsWith('SUPABASE_ACCESS_TOKEN='));
const token = process.env.SUPABASE_ACCESS_TOKEN
  || localTokenLine?.slice('SUPABASE_ACCESS_TOKEN='.length).trim();

if (!projectRef || !slug) throw new Error('Usage: node deploy-function-via-api.mjs <project-ref> <function-slug>');
if (!token) throw new Error('SUPABASE_ACCESS_TOKEN is required');

const entrypoint = resolve(import.meta.dirname, '..', 'supabase', 'functions', slug, 'index.ts');
const source = await readFile(entrypoint, 'utf8');
const form = new FormData();
form.append('metadata', JSON.stringify({
  name: slug,
  entrypoint_path: 'index.ts',
  verify_jwt: false,
}));
form.append('file', new Blob([source], { type: 'application/typescript' }), 'index.ts');

const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/functions/deploy?slug=${encodeURIComponent(slug)}`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: form,
});
const body = await response.text();
if (!response.ok) throw new Error(`Supabase function deploy failed (${response.status}): ${body}`);

const result = body ? JSON.parse(body) : {};
console.log(JSON.stringify({ slug: result.slug, status: result.status, version: result.version, verifyJwt: result.verify_jwt }));
