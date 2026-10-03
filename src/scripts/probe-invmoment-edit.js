import fs from 'node:fs';
import FormData from 'form-data';
import { switchSite, config } from '../config.js';
import { ZeyaAuth } from '../zeya/auth.js';
import { ZeyaInvitation } from '../zeya/invitation.js';

switchSite('invmoment');
console.log('site', config.zeya.baseUrl, config.zeya.api);

const auth = new ZeyaAuth();
const invitation = new ZeyaInvitation(auth);
await auth.ensureLogin({ force: true });

const list = await invitation.listInvitations({ maxPages: 3 });
console.log(
  'invitations',
  list.slice(0, 10).map((i) => `${i.postId}:${i.slug}`),
);

let postId = list[0]?.postId || process.env.POST_ID || '';
if (!postId) {
  // Create a tiny draft to inspect edit page
  const theme = (await invitation.listTemplates('44')).find((t) =>
    /premium\s*0?3/i.test(t.name),
  );
  console.log('theme for create', theme);
  const slug = `probe-${Date.now().toString().slice(-6)}`;
  const created = await invitation.createInvitation({
    title: 'Probe Bot',
    slug,
    categoryId: theme?.categoryId || '44',
    templateId: theme?.id,
    templateName: theme?.name,
    taxonomy: theme?.taxonomy || 'wds_template_wedding',
  });
  postId = created.postId;
  console.log('created', created.postId, created.slug, created.redirect);
}

console.log('using postId', postId);
const client = auth.getClient();
const res = await client.get(`/dashboard/invitation/edit/?id=${postId}`, {
  headers: { Accept: 'text/html' },
});
const html = String(res.data || '');
fs.writeFileSync('tmp-invmoment-edit.html', html);
console.log('edit status', res.status, 'len', html.length, 'auth?', html.includes('wds_auth_form'));

const formIds = [...new Set([...html.matchAll(/data-form-id=["'](\d+)["']/gi)].map((m) => m[1]))];
console.log('formIds', formIds.join(','));

const fieldNames = [
  'judul_undangan',
  '_slug',
  '_tanggal_acara',
  '_tanggal_acara_cover',
  '_meta_judul',
  '_nama_lengkap_wanita',
  '_nama_lengkap_pria',
  '_nama_acara_1',
  '_nama_bank_1',
];
for (const f of fieldNames) {
  const hit =
    html.includes(`name="${f}"`) ||
    html.includes(`name='${f}'`) ||
    html.includes(`data-field-name="${f}"`);
  console.log('field', f, hit);
}

// Find JetForm / submit endpoints
const ajaxHints = [
  'method=ajax',
  'jet-form-builder',
  'n1Z55l',
  'admin-ajax.php',
  'run_wds',
  'wds_form_edit',
  'form-id',
  'data-form-id',
];
for (const h of ajaxHints) {
  console.log('hint', h, html.toLowerCase().includes(h.toLowerCase()));
}

const actionUrls = [...html.matchAll(/action=["']([^"']+)["']/gi)].map((m) => m[1]);
console.log('actions unique', [...new Set(actionUrls)].slice(0, 20));

const methodAjax = [...html.matchAll(/method=ajax[^"'\s]*/gi)].map((m) => m[0]);
console.log('method=ajax', [...new Set(methodAjax)].slice(0, 10));

// Music nonce patterns
console.log(
  'music nonce patterns',
  !!html.match(/wds_form_edit_music/),
  !!html.match(/formData\.append\(\s*['"]nonce['"]/),
  html.match(/["']nonce["']\s*,\s*['"]([a-f0-9]+)['"]/i)?.[1],
  html.match(/ajax_nonce["']\s*:\s*["']([a-f0-9]+)/i)?.[1],
);

// Try submit form 10608 style vs discover real form id for judul
const judulForm =
  html.match(/data-form-id=["'](\d+)["'][\s\S]{0,400}?name=["']judul_undangan["']/i) ||
  html.match(/name=["']judul_undangan["'][\s\S]{0,800}?data-form-id=["'](\d+)["']/i);
console.log('judul form near', judulForm?.[1] || judulForm?.[0]?.slice?.(0, 80));

// Find enclosing form for judul_undangan
const idx = html.search(/name=["']judul_undangan["']/i);
if (idx >= 0) {
  const before = html.slice(Math.max(0, idx - 2500), idx);
  const formOpen = before.lastIndexOf('<form');
  const chunk = before.slice(formOpen, before.length) + html.slice(idx, idx + 800);
  console.log('--- form chunk around judul ---');
  console.log(chunk.slice(0, 1200));
  fs.writeFileSync('tmp-invmoment-judul-form.html', chunk);
}

// Probe one submit with discovered form id
const formId =
  html.match(
    /<form[^>]*data-form-id=["'](\d+)["'][^>]*>[\s\S]*?name=["']judul_undangan["']/i,
  )?.[1] || formIds[0];
console.log('submit probe formId', formId);

if (formId) {
  const actionMatch = html.match(
    new RegExp(`data-form-id=["']${formId}["'][^>]*action=["']([^"']+)["']`, 'i'),
  ) || html.match(
    new RegExp(`<form[^>]*action=["']([^"']+)["'][^>]*data-form-id=["']${formId}["']`, 'i'),
  );
  console.log('form action', actionMatch?.[1]);

  // Try current bot endpoint
  const form = new FormData();
  form.append('_jfb_current_render_states[]', 'DEFAULT.STATE');
  form.append('_jet_engine_booking_form_id', String(formId));
  form.append('_jet_engine_refer', `${config.zeya.baseUrl}/dashboard/invitation/edit/?id=${postId}`);
  form.append('__queried_post_id', String(postId));
  form.append('post_id', String(postId));
  form.append('judul_undangan', 'Probe Judul Bot');
  form.append('_slug', list[0]?.slug || `probe-${postId}`);

  for (const path of [
    `/dashboard/invitation/edit/?n1Z55l=T0Z21s89r7Yt&method=ajax`,
    `/dashboard/invitation/edit/?id=${postId}&method=ajax`,
    actionMatch?.[1]?.replace(config.zeya.baseUrl, '') || '',
  ].filter(Boolean)) {
    const r = await client.post(path.startsWith('http') ? path : path, form, {
      headers: {
        ...form.getHeaders(),
        'X-Requested-With': 'XMLHttpRequest',
        Accept: 'application/json, text/javascript, */*; q=0.01',
        Referer: `${config.zeya.baseUrl}/dashboard/invitation/edit/?id=${postId}`,
      },
      validateStatus: () => true,
      maxBodyLength: Infinity,
    });
    const body = typeof r.data === 'string' ? r.data.slice(0, 180) : JSON.stringify(r.data).slice(0, 250);
    console.log('POST', path.slice(0, 80), 'status', r.status, 'body', body);
  }
}
