import http from 'node:http';

const port = 3000;
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

if (!supabaseUrl || !publishableKey) {
  throw new Error('请先设置 EXPO_PUBLIC_SUPABASE_URL 和 EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY。');
}

const html = String.raw`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="referrer" content="no-referrer">
  <title>JSun Bite · 账号确认</title>
  <style>
    *{box-sizing:border-box}body{margin:0;background:#fff9ef;color:#2e2925;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;min-height:100vh;display:grid;place-items:center;padding:24px}.card{width:min(440px,100%);background:#fff;border:1px solid #eadfce;border-radius:28px;padding:30px;box-shadow:0 18px 50px rgba(79,59,34,.08)}.dog{font-size:48px;text-align:center}.eyebrow{text-align:center;color:#8b6842;font-size:13px;font-weight:800;margin-top:8px}h1{text-align:center;font-size:25px;margin:7px 0 10px}p{color:#756b62;line-height:1.7;font-size:14px}.field{margin-top:16px}label{font-size:13px;font-weight:800;display:block;margin-bottom:7px}input{width:100%;height:50px;border:1px solid #ded2c1;border-radius:15px;background:#fffaf2;padding:0 14px;font-size:16px}button{width:100%;height:52px;border:0;border-radius:17px;background:#2e2925;color:white;font-weight:900;font-size:15px;margin-top:18px;cursor:pointer}.status{margin-top:14px;border-radius:13px;padding:11px 13px;font-size:13px;line-height:1.6;display:none}.ok{display:block;background:#eaf7ef;color:#367a50}.bad{display:block;background:#fff0ee;color:#a34b42}.hint{text-align:center;font-size:12px;margin-top:15px}.hidden{display:none}
  </style>
</head>
<body>
  <main class="card">
    <div class="dog">🐶</div>
    <div class="eyebrow">JSun Bite</div>
    <h1 id="title">正在确认链接呀…</h1>
    <p id="copy">豆包正在检查这封邮件，请稍等一下儿。</p>
    <section id="reset" class="hidden">
      <div class="field"><label for="password">新密码（至少 6 位）</label><input id="password" type="password" autocomplete="new-password"></div>
      <div class="field"><label for="confirm">再次输入新密码</label><input id="confirm" type="password" autocomplete="new-password"></div>
      <button id="submit">保存新密码</button>
    </section>
    <div id="status" class="status"></div>
    <p class="hint">完成后关闭本页，回到 JSun Bite 登录。</p>
  </main>
  <script>
    const supabaseUrl = ${JSON.stringify(supabaseUrl)};
    const publishableKey = ${JSON.stringify(publishableKey)};
    const params = new URLSearchParams(location.hash.slice(1));
    const token = params.get('access_token');
    const type = params.get('type');
    const title = document.querySelector('#title');
    const copy = document.querySelector('#copy');
    const reset = document.querySelector('#reset');
    const status = document.querySelector('#status');
    const show = (message, ok) => { status.textContent = message; status.className = 'status ' + (ok ? 'ok' : 'bad'); };

    if (params.get('error_description')) {
      title.textContent = '这个链接没有成功';
      copy.textContent = params.get('error_description');
    } else if (type === 'recovery' && token) {
      title.textContent = '重新设置密码';
      copy.textContent = '换一个记得住的新密码吧，这次豆包帮你认真检查两遍。';
      reset.classList.remove('hidden');
    } else if (token) {
      title.textContent = '邮箱确认好啦';
      copy.textContent = '这次不是空白页啦。现在可以关闭这里，回到 JSun Bite 登录。';
      show('邮箱验证已经完成。', true);
      history.replaceState(null, '', location.pathname);
    } else {
      title.textContent = '链接里没有确认信息';
      copy.textContent = '请从最新一封 JSun Bite 邮件重新打开链接。';
    }

    document.querySelector('#submit').addEventListener('click', async () => {
      const password = document.querySelector('#password').value;
      const confirm = document.querySelector('#confirm').value;
      if (password.length < 6) return show('密码至少需要 6 位呀。', false);
      if (password !== confirm) return show('两次密码不一样，再检查一下儿呀。', false);
      const button = document.querySelector('#submit');
      button.disabled = true;
      button.textContent = '正在保存…';
      try {
        const response = await fetch(supabaseUrl + '/auth/v1/user', {
          method: 'PUT',
          headers: { apikey: publishableKey, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.msg || body.message || '保存失败');
        reset.classList.add('hidden');
        title.textContent = '新密码保存好啦';
        copy.textContent = '关闭这个页面，回到 JSun Bite 用新密码登录吧。';
        show('密码已经更新成功。', true);
        history.replaceState(null, '', location.pathname);
      } catch (error) {
        show(error instanceof Error ? error.message : '保存失败，请重新打开最新邮件。', false);
        button.disabled = false;
        button.textContent = '保存新密码';
      }
    });
  </script>
</body>
</html>`;

http.createServer((_request, response) => {
  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
  });
  response.end(html);
}).listen(port, '0.0.0.0', () => {
  console.log(`JSun Bite recovery page is ready at http://localhost:${port}`);
});
