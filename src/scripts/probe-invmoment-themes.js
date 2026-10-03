import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import FormData from 'form-data';
import fs from 'node:fs';

const BASE = 'https://invmoment.my.id';
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

async function login() {
  const loginPage = await client.get('/auth/login/', { headers: { Accept: 'text/html' } });
  const nonce = String(loginPage.data).match(/["']ajax_nonce["']\s*:\s*["']([a-f0-9]+)["']/i)?.[1];
  const form = new FormData();
  form.append('email', 'devinaoktiani04@gmail.com');
  form.append('password', 'Zeya2018');
  form.append('rememberme', 'on');
  form.append('name', 'login');
  form.append('action', 'run_wds');
  form.append('__nonce', nonce);
  const res = await client.post('/wp-admin/admin-ajax.php', form, {
    headers: { ...form.getHeaders(), 'X-Requested-With': 'XMLHttpRequest' },
  });
  console.log('login', res.data);
  return nonce;
}

function ajaxNonceFrom(html) {
  return String(html).match(/["']ajax_nonce["']\s*:\s*["']([a-f0-9]+)["']/i)?.[1] || '';
}

await login();
const createHtml = String(
  (await client.get('/dashboard/invitation/create/', { headers: { Accept: 'text/html' } })).data || '',
);
const nonce = ajaxNonceFrom(createHtml);
console.log('create nonce', nonce);

const cats = await client.post(
  '/wp-admin/admin-ajax.php',
  new URLSearchParams({
    name: 'invitation_get_category',
    action: 'run_wds',
    __nonce: nonce,
  }).toString(),
  {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest',
    },
  },
);
console.log('categories type', typeof cats.data, Array.isArray(cats.data));
console.log(JSON.stringify(cats.data, null, 2)?.slice(0, 1500));

const catList = Array.isArray(cats.data) ? cats.data.filter((c) => c.ID) : [];
for (const cat of catList) {
  const catId = cat.ID;
  console.log('\n== category', catId, cat.name, '==');
  const themes = await client.post(
    '/wp-admin/admin-ajax.php',
    new URLSearchParams({
      name: 'invitation_get_theme',
      action: 'run_wds',
      __nonce: nonce,
      category: String(catId),
      subcategory: '',
      subtheme: '',
      orderby: '',
    }).toString(),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
      },
    },
  );
  const list = Array.isArray(themes.data) ? themes.data : [];
  console.log('themes', list.length);
  if (!list.length) {
    console.log('raw', JSON.stringify(themes.data)?.slice(0, 200));
    continue;
  }
  fs.writeFileSync(`tmp-invmoment-themes-${catId}.json`, JSON.stringify(themes.data, null, 2));
  console.log(
    list
      .slice(0, 20)
      .map((t) => `${t.ID || t.id || t.post_id}: ${t.post_title || t.title || t.name}`)
      .join('\n'),
  );
  const premium = list.filter((t) => /premium\s*3|premium/i.test(`${t.post_title || ''} ${t.name || ''}`));
  console.log(
    'premium-ish',
    premium.slice(0, 10).map((t) => `${t.ID || t.id}: ${t.post_title || t.name}`),
  );
}
