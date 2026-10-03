import fs from 'node:fs';
import FormData from 'form-data';
import { switchSite, config } from '../config.js';
import { ZeyaAuth } from '../zeya/auth.js';

switchSite('invmoment');
const auth = new ZeyaAuth();
await auth.ensureLogin({ force: true });
const client = auth.getClient();
const postId = '32851';
const html = String(
  (await client.get(`/dashboard/invitation/edit/?id=${postId}`, { headers: { Accept: 'text/html' } }))
    .data || '',
);
const nonce = html.match(/["']ajax_nonce["']\s*:\s*["']([a-f0-9]+)["']/i)?.[1];
const referer = `${config.zeya.baseUrl}/dashboard/invitation/edit/?id=${postId}`;

// 1x1 PNG
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5W2fQAAAAASUVORK5CYII=',
  'base64',
);
fs.writeFileSync('tmp-1x1.png', png);

const form = new FormData();
form.append('action', 'run_wds_theme');
form.append('name', 'setting_form');
form.append('__nonce', nonce);
form.append('post_id', postId);
form.append('title', 'Smoke Probe OK');
form.append('slug', 'smoke-im-444235');
form.append('description', 'Deskripsi undangan smoke test tanpa karakter aneh');
form.append('thumbnail', png, { filename: 'thumb.png', contentType: 'image/png' });

const r = await client.post('/wp-admin/admin-ajax.php', form, {
  headers: {
    ...form.getHeaders(),
    'X-Requested-With': 'XMLHttpRequest',
    Referer: referer,
  },
  validateStatus: () => true,
  maxBodyLength: Infinity,
});
console.log('with png', JSON.stringify(r.data).slice(0, 300));

// Also try jpeg extension
const form2 = new FormData();
form2.append('action', 'run_wds_theme');
form2.append('name', 'setting_form');
form2.append('__nonce', nonce);
form2.append('post_id', postId);
form2.append('title', 'Smoke Probe OK');
form2.append('slug', 'smoke-im-444235');
form2.append('description', 'Deskripsi undangan smoke test');
form2.append('thumbnail', png, { filename: 'thumb.jpg', contentType: 'image/jpeg' });
const r2 = await client.post('/wp-admin/admin-ajax.php', form2, {
  headers: {
    ...form2.getHeaders(),
    'X-Requested-With': 'XMLHttpRequest',
    Referer: referer,
  },
  validateStatus: () => true,
  maxBodyLength: Infinity,
});
console.log('as jpg name', JSON.stringify(r2.data).slice(0, 300));
