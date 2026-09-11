import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const origin = process.argv[2] ?? 'https://jsun-bite.expo.app';
const response = await fetch(origin);
if (!response.ok) throw new Error(`Web deployment returned ${response.status}`);
const html = await response.text();
const scriptPath = html.match(/<script src="([^"]+\.js)"/)?.[1];
if (!scriptPath) throw new Error('Could not find the web bundle');
const bundleResponse = await fetch(new URL(scriptPath, origin));
if (!bundleResponse.ok) throw new Error(`Web bundle returned ${bundleResponse.status}`);
const bundle = Buffer.from(await bundleResponse.arrayBuffer());
const localBundle = await readFile(resolve('dist', scriptPath.replace(/^\//, '')));
const digest = (value) => createHash('sha256').update(value).digest('hex');

const checks = {
  exactPublishedBuild: digest(bundle) === digest(localBundle),
  manifestLinked: html.includes('/manifest.json'),
};

console.log(JSON.stringify({ status: response.status, ...checks }));
if (Object.values(checks).some((value) => !value)) process.exitCode = 1;
