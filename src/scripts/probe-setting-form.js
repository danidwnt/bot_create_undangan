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
const slug = html.match(/name=["']slug["'][^>]*value=["']([^"']*)["']/i)?.[1];
const title = html.match(/name=["']title["'][^>]*value=["']([^"']*)["']/i)?.[1];
const desc =
  html.match(/<textarea[^>]*name=["']description["'][^>]*>([\s\S]*?)<\/textarea>/i)?.[1] || '';

console.log({ nonce, slug, title, desc: desc.slice(0, 60) });

async function tryOne(label, makeReq) {
  const r = await makeReq();
  console.log(
    label,
    r.status,
    typeof r.data === 'string' ? r.data.slice(0, 200) : JSON.stringify(r.data).slice(0, 250),
  );
}

const referer = `${config.zeya.baseUrl}/dashboard/invitation/edit/?id=${postId}`;

// 1) urlencoded keep existing
await tryOne('urlencoded-keep', () => {
  const body = new URLSearchParams({
    action: 'run_wds_theme',
    name: 'setting_form',
    __nonce: nonce,
    post_id: postId,
    title: title || 'Smoke',
    slug: slug || 'smoke',
    description: desc || 'Deskripsi',
  });
  return client.post('/wp-admin/admin-ajax.php', body.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest',
      Referer: referer,
    },
    validateStatus: () => true,
  });
});

// 2) multipart without thumbnail
await tryOne('multipart-no-thumb', () => {
  const form = new FormData();
  form.append('action', 'run_wds_theme');
  form.append('name', 'setting_form');
  form.append('__nonce', nonce);
  form.append('post_id', postId);
  form.append('title', 'Smoke & Probe');
  form.append('slug', slug || 'smoke');
  form.append('description', desc || 'Deskripsi');
  return client.post('/wp-admin/admin-ajax.php', form, {
    headers: {
      ...form.getHeaders(),
      'X-Requested-With': 'XMLHttpRequest',
      Referer: referer,
    },
    validateStatus: () => true,
  });
});

// 3) only title
await tryOne('urlencoded-title-only', () => {
  const body = new URLSearchParams({
    action: 'run_wds_theme',
    name: 'setting_form',
    __nonce: nonce,
    post_id: postId,
    title: 'Smoke Probe Title',
  });
  return client.post('/wp-admin/admin-ajax.php', body.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest',
      Referer: referer,
    },
    validateStatus: () => true,
  });
});
