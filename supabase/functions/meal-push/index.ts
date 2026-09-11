import { createClient } from 'npm:@supabase/supabase-js@2';

type MealRecord = {
  id: string;
  couple_id: string;
  author_id: string;
  title: string | null;
  meal_type: string;
};

type WebhookPayload = {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  schema: string;
  record: MealRecord;
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const webhookSecret = Deno.env.get('MEAL_WEBHOOK_SECRET');
  if (!supabaseUrl || !serviceRoleKey || !webhookSecret) {
    return json({ error: 'Server is not configured' }, 500);
  }

  const suppliedSecret = request.headers.get('x-webhook-secret');
  if (suppliedSecret !== webhookSecret) return json({ error: 'Unauthorized' }, 401);

  const payload = await request.json() as WebhookPayload;
  if (payload.type !== 'INSERT' || payload.schema !== 'public' || payload.table !== 'meals') {
    return json({ skipped: true });
  }

  const meal = payload.record;
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: couple, error: coupleError } = await admin
    .from('couples')
    .select('member_a, member_b')
    .eq('id', meal.couple_id)
    .single();
  if (coupleError) return json({ error: coupleError.message }, 500);

  const recipientId = couple.member_a === meal.author_id ? couple.member_b : couple.member_a;
  if (!recipientId || recipientId === meal.author_id) return json({ skipped: true, reason: 'No partner' });

  const [{ data: profile }, { data: tokenRows, error: tokenError }] = await Promise.all([
    admin.from('profiles').select('nickname').eq('id', meal.author_id).single(),
    admin.from('push_tokens').select('expo_push_token').eq('user_id', recipientId),
  ]);
  if (tokenError) return json({ error: tokenError.message }, 500);

  const tokens = (tokenRows ?? []).map((row) => row.expo_push_token);
  if (tokens.length === 0) return json({ skipped: true, reason: 'No push token' });

  const author = profile?.nickname?.trim() || 'TA';
  const mealName = meal.title?.trim().slice(0, 40);
  const messages = tokens.map((token) => ({
    to: token,
    sound: 'default',
    channelId: 'meals',
    title: `🐶 ${author} 开饭啦`,
    body: mealName
      ? `${author} 刚记了${meal.meal_type}「${mealName}」呀，快来瞧瞧～`
      : `${author} 刚记了一顿饭呀，快来瞧瞧～`,
    data: { type: 'meal', mealId: meal.id },
  }));

  const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Accept-Encoding': 'gzip, deflate',
    'Content-Type': 'application/json',
  };
  if (expoAccessToken) headers.Authorization = `Bearer ${expoAccessToken}`;

  const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers,
    body: JSON.stringify(messages),
  });
  const result = await expoResponse.json();
  if (!expoResponse.ok) return json({ error: 'Expo rejected the push request', detail: result }, 502);

  const tickets = Array.isArray(result.data) ? result.data : [result.data];
  const invalidTokens = tokens.filter((_, index) => (
    tickets[index]?.status === 'error' && tickets[index]?.details?.error === 'DeviceNotRegistered'
  ));
  if (invalidTokens.length > 0) {
    await admin.from('push_tokens').delete().in('expo_push_token', invalidTokens);
  }

  return json({ sent: tokens.length, removedInvalidTokens: invalidTokens.length });
});
