import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import FormData from 'form-data';

async function tryLogin(base, email, pass) {
  const jar = new CookieJar();
  const client = wrapper(
    axios.create({
      jar,
      withCredentials: true,
      baseURL: base,
      timeout: 45000,
      validateStatus: () => true,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
    }),
  );

  const loginPage = await client.get('/auth/login/', { headers: { Accept: 'text/html' } });
  const html = String(loginPage.data || '');
  const nonce =
    html.match(/["']ajax_nonce["']\s*:\s*["']([a-f0-9]+)["']/i)?.[1] ||
    html.match(/name=["']__nonce["']\s+value=["']([^"']+)/i)?.[1] ||
    '';
  console.log('\n==', base, '==');
  console.log('nonce', nonce);

  // Method A: legacy login_ajax_action
  {
    const body = new URLSearchParams({
      email,
      password: pass,
      rememberme: 'on',
      __nonce: nonce,
      _wp_http_referer: '/auth/login/',
      action: 'login_ajax_action',
    });
    const res = await client.post('/wp-admin/admin-ajax.php', body.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
        Referer: `${base}/auth/login/`,
      },
    });
    console.log('A login_ajax_action', res.status, JSON.stringify(res.data)?.slice(0, 200));
  }

  // Method B: run_wds + name=login (FormData)
  {
    const form = new FormData();
    form.append('email', email);
    form.append('password', pass);
    form.append('rememberme', 'on');
    form.append('name', 'login');
    form.append('action', 'run_wds');
    form.append('__nonce', nonce);
    const res = await client.post('/wp-admin/admin-ajax.php', form, {
      headers: {
        ...form.getHeaders(),
        'X-Requested-With': 'XMLHttpRequest',
        Referer: `${base}/auth/login/`,
      },
    });
    console.log('B run_wds', res.status, JSON.stringify(res.data)?.slice(0, 250));

    const list = await client.get('/dashboard/invitation/', { headers: { Accept: 'text/html' } });
    const lh = String(list.data || '');
    console.log(
      'after B: auth?',
      lh.includes('wds_auth_form'),
      'edits',
      (lh.match(/invitation\/edit/gi) || []).length,
      'title',
      lh.match(/<title>[^<]+/i)?.[0],
    );

    const create = await client.get('/dashboard/invitation/create/', {
      headers: { Accept: 'text/html' },
    });
    const ch = String(create.data || '');
    console.log(
      'create auth?',
      ch.includes('wds_auth_form'),
      'theme?',
      /weddingsaas_get_invitation_theme/i.test(ch),
    );

    const editId = lh.match(/invitation\/edit\/\?id=(\d+)/i)?.[1];
    if (editId) {
      const edit = await client.get(`/dashboard/invitation/edit/?id=${editId}`, {
        headers: { Accept: 'text/html' },
      });
      const eh = String(edit.data || '');
      const formIds = [...new Set([...eh.matchAll(/data-form-id="(\d+)"/g)].map((m) => m[1]))];
      console.log('edit', editId, 'forms', formIds.join(','));
    }
  }
}

await tryLogin('https://invmoment.my.id', 'devinaoktiani04@gmail.com', 'Zeya2018');
await tryLogin('https://zeyainvitation.com', 'devinaoktiani04@gmail.com', 'Zeya2018');
