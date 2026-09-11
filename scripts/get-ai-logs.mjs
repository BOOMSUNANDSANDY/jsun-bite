const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) throw new Error('SUPABASE_ACCESS_TOKEN is required');

const projectRef = process.env.SUPABASE_PROJECT_REF;
if (!projectRef) throw new Error('SUPABASE_PROJECT_REF is required');
const end = new Date();
const start = new Date(end.getTime() - 2 * 60 * 60 * 1000);
const sql = `
  select timestamp, event_message, severity_text
  from logs
  where source = 'function_logs'
    and event_message like '%Ark request failed%'
  order by timestamp desc
  limit 20
`;
const query = new URLSearchParams({
  sql,
  iso_timestamp_start: start.toISOString(),
  iso_timestamp_end: end.toISOString(),
});

const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/analytics/endpoints/logs?${query}`, {
  headers: { Authorization: `Bearer ${token}` },
});
const body = await response.text();
if (!response.ok) throw new Error(`Log query failed (${response.status}): ${body}`);
console.log(body);
