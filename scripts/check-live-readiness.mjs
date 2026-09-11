import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const envPath = path.join(root, '.env');
const values = {};
const appConfig = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));

if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) values[match[1]] = match[2].trim();
  }
}

const easProjectId = values.EXPO_PUBLIC_EAS_PROJECT_ID ?? appConfig.expo?.extra?.eas?.projectId ?? '';

const checks = [
  ['Supabase Project URL', /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(values.EXPO_PUBLIC_SUPABASE_URL ?? '')],
  ['Supabase Publishable Key', /^(sb_publishable_|eyJ)/.test(values.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '')],
  ['EAS Project ID', /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(easProjectId)],
  ['EAS build config', fs.existsSync(path.join(root, 'eas.json'))],
  ['Supabase initial migration', fs.existsSync(path.join(root, 'supabase', 'migrations', '20260901000000_initial_schema.sql'))],
  ['Meal Push function', fs.existsSync(path.join(root, 'supabase', 'functions', 'meal-push', 'index.ts'))],
];

for (const [label, ready] of checks) {
  console.log(`${ready ? '✓' : '○'} ${label}`);
}

if (checks.some(([, ready]) => !ready)) {
  console.error('\n还不能开始双机联调：请先补齐上方带 ○ 的配置。检查器不会显示任何密钥内容。');
  process.exit(1);
}

console.log('\n配置文件已经齐全，可以继续数据库部署和 iPhone 开发构建。');
