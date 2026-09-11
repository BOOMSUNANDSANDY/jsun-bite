const productionUrl = process.argv[2] ?? 'https://jsun-bite.expo.app';
const supabaseUrl = process.argv[3] ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
if (!supabaseUrl) throw new Error('Pass the Supabase URL as the second argument or set EXPO_PUBLIC_SUPABASE_URL');
const functionUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/analyze-meal`;

const pageResponse = await fetch(productionUrl);
const html = await pageResponse.text();
const source = html.match(/src="([^"]+index-[^"]+\.js)"/)?.[1];
if (!source) throw new Error('Production JavaScript bundle was not found');

const bundle = await fetch(new URL(source, productionUrl)).then((response) => response.text());
const optionsResponse = await fetch(functionUrl, { method: 'OPTIONS' });
const unauthorizedResponse = await fetch(functionUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: '{}',
});

console.log(JSON.stringify({
  productionStatus: pageResponse.status,
  bundleHasDoubaoAi: bundle.includes('analyze-meal') && bundle.includes('imageBase64'),
  corsStatus: optionsResponse.status,
  unauthorizedStatus: unauthorizedResponse.status,
  unauthorizedBody: await unauthorizedResponse.json(),
}));
