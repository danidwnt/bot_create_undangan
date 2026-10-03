import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';

const BASE = 'https://invmoment.my.id';
const EMAIL = 'devinaoktiani04@gmail.com';
const PASS = 'Zeya2018';

const jar = new CookieJar();
const client = wrapper(
  axios.create({
    jar,
    withCredentials: true,
    baseURL: BASE,
    timeout: 45000,
    validateStatus: () => true,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    },
  }),
);

function extractNonce(html) {
  return (
    html.match(/name=["']__nonce["']\s+value=["']([^"']+)/i)?.[1] ||
    html.match(/value=["']([^"']+)["']\s+name=["']__nonce["']/i)?.[1] ||
    html.match(/["']ajax_nonce["']\s*:\s*["']([a-f0-9]+)["']/i)?.[1] ||
    ''
  );
}

async function main() {
  for (const p of ['/', '/auth/login/', '/dashboard/', '/dashboard/invitation/']) {
    const r = await client.get(p, { headers: { Accept: 'text/html' } });
    const h = String(r.data || '');
    console.log(
      'GET',
      p,
      r.status,
      'title=',
      h.match(/<title>[^<]+/i)?.[0],
      'auth=',
      h.includes('wds_auth_form'),
      'create=',
      h.includes('invitation/create'),
    );
  }

  const loginPage = await client.get('/auth/login/', { headers: { Accept: 'text/html' } });
  const html = String(loginPage.data || '');
  const nonce = extractNonce(html);
  console.log('login nonce', nonce ? 'OK' : 'MISSING');

  const body = new URLSearchParams({
    email: EMAIL,
    password: PASS,
    rememberme: 'on',
    __nonce: nonce,
    _wp_http_referer: '/auth/login/',
    action: 'login_ajax_action',
  });

  const res = await client.post('/wp-admin/admin-ajax.php', body.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest',
      Referer: `${BASE}/auth/login/`,
    },
  });
  console.log('LOGIN', res.status, JSON.stringify(res.data)?.slice(0, 300));

  const list = await client.get('/dashboard/invitation/', { headers: { Accept: 'text/html' } });
  const listHtml = String(list.data || '');
  console.log(
    'INV LIST',
    list.status,
    'auth?',
    listHtml.includes('wds_auth_form'),
    'cards?',
    (listHtml.match(/invitation\/edit/gi) || []).length,
  );

  const create = await client.get('/dashboard/invitation/create/', {
    headers: { Accept: 'text/html' },
  });
  const createHtml = String(create.data || '');
  console.log(
    'CREATE',
    create.status,
    'auth?',
    createHtml.includes('wds_auth_form'),
    'theme ajax?',
    /weddingsaas_get_invitation_theme/i.test(createHtml),
  );

  // Open first edit if any
  const editId = listHtml.match(/invitation\/edit\/\?id=(\d+)/i)?.[1];
  if (editId) {
    const edit = await client.get(`/dashboard/invitation/edit/?id=${editId}`, {
      headers: { Accept: 'text/html' },
    });
    const eh = String(edit.data || '');
    const formIds = [...eh.matchAll(/data-form-id="(\d+)"/g)].map((m) => m[1]);
    console.log('EDIT', editId, 'forms', [...new Set(formIds)].join(','));
    console.log(
      'fields',
      [
        '_tanggal_acara_cover',
        '_tanggal_acara',
        'judul_undangan',
        '_slug',
        '_nama_lengkap_wanita',
        '_nama_lengkap_pria',
      ]
        .map((f) => `${f}:${eh.includes(`name="${f}"`) || eh.includes(`name='${f}'`)}`)
        .join(' | '),
    );
  } else {
    console.log('No existing invitation edit link found');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
