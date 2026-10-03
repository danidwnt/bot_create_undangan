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

const loginPage = await client.get('/auth/login/', { headers: { Accept: 'text/html' } });
const nonce = String(loginPage.data).match(/["']ajax_nonce["']\s*:\s*["']([a-f0-9]+)["']/i)?.[1];
const form = new FormData();
form.append('email', 'devinaoktiani04@gmail.com');
form.append('password', 'Zeya2018');
form.append('rememberme', 'on');
form.append('name', 'login');
form.append('action', 'run_wds');
form.append('__nonce', nonce);
await client.post('/wp-admin/admin-ajax.php', form, {
  headers: { ...form.getHeaders(), 'X-Requested-With': 'XMLHttpRequest' },
});

const create = await client.get('/dashboard/invitation/create/', { headers: { Accept: 'text/html' } });
const html = String(create.data || '');
fs.writeFileSync('tmp-invmoment-create.html', html);
console.log('title', html.match(/<title>[^<]+/i)?.[0]);
console.log('WDS', html.match(/var WDS = (\{[\s\S]*?\});/)?.[1]?.slice(0, 400));

const hits = [
  'weddingsaas_get_invitation',
  'get_invitation_theme',
  'get_invitation_category',
  'run_wds',
  'ajax_nonce',
  'template',
  'category',
  'data-form-id',
];
for (const h of hits) {
  console.log(h, html.toLowerCase().includes(h.toLowerCase()));
}

// Find select/options related to theme
const selects = [...html.matchAll(/<select[^>]*name=["']([^"']+)["'][^>]*>/gi)].map((m) => m[1]);
console.log('selects', selects.slice(0, 30));

const actions = [...html.matchAll(/action['"]\s*:\s*['"]([^'"]+)['"]/gi)].map((m) => m[1]);
console.log('actions sample', [...new Set(actions)].slice(0, 40));

const nonceHits = [...html.matchAll(/nonce[=:]\s*['"]?([a-f0-9]{8,})/gi)].map((m) => m[1]);
console.log('nonces', [...new Set(nonceHits)].slice(0, 10));
