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

const candidates = [
  { action: 'run_wds_theme', name: 'setting_form' },
  { action: 'run_wds', name: 'setting_form' },
  { action: 'run_wds', name: 'invitation_edit_setting' },
  { action: 'run_wds', name: 'invitation_settings' },
  { action: 'run_wds_theme', name: 'settings_form' },
];

for (const c of candidates) {
  const body = new URLSearchParams({
    action: c.action,
    name: c.name,
    __nonce: nonce,
    post_id: postId,
    title: 'Smoke Probe OK',
    slug: 'smoke-im-444235',
    description: 'Deskripsi undangan smoke test',
  });
  const r = await client.post('/wp-admin/admin-ajax.php', body.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest',
      Referer: referer,
    },
    validateStatus: () => true,
  });
  console.log(
    c.action,
    c.name,
    typeof r.data === 'string' ? r.data.slice(0, 160) : JSON.stringify(r.data).slice(0, 200),
  );
}
