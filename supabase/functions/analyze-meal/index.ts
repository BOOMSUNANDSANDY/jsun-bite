import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

function extractJson(value: string) {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? value.slice(value.indexOf('{'), value.lastIndexOf('}') + 1);
  return JSON.parse(candidate);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const legacyPublishableKey = Deno.env.get('SUPABASE_ANON_KEY');
  let currentPublishableKey = '';
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}') as Record<string, string>;
    currentPublishableKey = keys.default || Object.values(keys)[0] || '';
  } catch {
    currentPublishableKey = '';
  }
  const publishableKey = legacyPublishableKey || currentPublishableKey;
  const arkApiKey = Deno.env.get('ARK_API_KEY');
  const arkModel = Deno.env.get('ARK_MODEL_ID') || 'doubao-seed-2-1-pro-260628';
  if (!supabaseUrl || !publishableKey || !arkApiKey) {
    return json({ error: '识图服务还没有配置完成呀。' }, 503);
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return json({ error: '请先登录再使用识图呀。' }, 401);

  const authClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) return json({ error: '登录状态过期了，请重新登录呀。' }, 401);

  let body: { imageBase64?: unknown; mimeType?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: '照片数据没有传完整呀。' }, 400);
  }

  const imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64 : '';
  const mimeType = body.mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
  if (!imageBase64 || imageBase64.length > 8_000_000) {
    return json({ error: imageBase64 ? '这张照片太大啦，换一张试试呀。' : '还没有收到照片呀。' }, 400);
  }

  const arkResponse = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${arkApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: arkModel,
      disable_deep_thinking: true,
      temperature: 0.1,
      max_tokens: 120,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: '你是情侣饮食记录 App 的识图助手。识别照片中的整顿饭，不拆分罗列食材；给出自然简短的中文名称，并粗略估算整顿饭的总热量。热量只作生活记录参考。只返回 JSON，不要 Markdown：{"title":"菜名或整顿饭名称","calories":整数或null,"message":"一句温暖、自然、带呀/啦/儿化词的简短提醒"}。看不出是食物时 title 为空字符串、calories 为 null，并温柔请用户手填。',
          },
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: 'low' },
          },
        ],
      }],
    }),
  });

  const arkBody = await arkResponse.json().catch(() => null);
  if (!arkResponse.ok) {
    const arkErrorCode = typeof arkBody?.error?.code === 'string' ? arkBody.error.code : '';
    console.error('Ark request failed', arkResponse.status, arkErrorCode, arkBody?.error?.message);
    const userMessage = arkResponse.status === 429
      ? '豆包现在有点忙，稍后再试一下儿呀。'
      : arkErrorCode === 'ModelNotOpen'
        ? '豆包模型还没有开通或者模型号不对呀。'
        : arkResponse.status === 401 || arkResponse.status === 403
          ? '豆包密钥或调用权限有问题呀。'
          : '豆包暂时没有接通，再试一下儿呀。';
    return json({ error: userMessage }, 502);
  }

  const content = arkBody?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') return json({ error: '豆包的回答没接完整，再试一次儿呀。' }, 502);

  try {
    const parsed = extractJson(content);
    const title = typeof parsed.title === 'string' ? parsed.title.trim().slice(0, 60) : '';
    const rawCalories = typeof parsed.calories === 'number' ? parsed.calories : Number(parsed.calories);
    const calories = Number.isFinite(rawCalories) && rawCalories > 0 && rawCalories <= 5000
      ? Math.round(rawCalories / 10) * 10
      : null;
    const message = typeof parsed.message === 'string' && parsed.message.trim()
      ? parsed.message.trim().slice(0, 100)
      : title ? '我先粗略认了一下，你再确认一眼儿呀～' : '这张我没认准，你自己写一下儿呀～';
    return json({ title, calories, message });
  } catch (error) {
    console.error('Ark JSON parse failed', error, content.slice(0, 500));
    return json({ error: '豆包的回答有点乱，再试一次儿呀。' }, 502);
  }
});
