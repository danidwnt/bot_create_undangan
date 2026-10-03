import FormData from 'form-data';
import { switchSite, config } from '../config.js';
import { ZeyaAuth } from '../zeya/auth.js';

switchSite('invmoment');
const auth = new ZeyaAuth();
await auth.ensureLogin({ force: true });
const client = auth.getClient();
const postId = process.env.POST_ID || '32850';
const html = String(
  (
    await client.get(`/dashboard/invitation/edit/?id=${postId}`, {
      headers: { Accept: 'text/html' },
    })
  ).data || '',
);
const nonce = html.match(/["']ajax_nonce["']\s*:\s*["']([a-f0-9]+)["']/i)?.[1];
const selected = html.match(/data-audio=["'](https?:\/\/[^"']+\.mp3)["']/i)?.[1];
const form = new FormData();
form.append('action', 'run_wds');
form.append('name', 'invitation_edit_audio');
form.append('__nonce', nonce);
form.append('post_id', postId);
form.append('audio_type', 'default');
form.append('selected', selected);
form.append('audio_custom_mode', 'upload');
const r = await client.post('/wp-admin/admin-ajax.php', form, {
  headers: {
    ...form.getHeaders(),
    'X-Requested-With': 'XMLHttpRequest',
    Referer: `${config.zeya.baseUrl}/dashboard/invitation/edit/?id=${postId}`,
  },
  validateStatus: () => true,
});
console.log('nonce', nonce);
console.log('selected', selected?.slice(0, 100));
console.log('res', typeof r.data === 'string' ? r.data.slice(0, 300) : JSON.stringify(r.data).slice(0, 300));

// acara-3 field?
console.log('acara3 fields', {
  _acara_ketiga: html.includes('_acara_ketiga'),
  _nama_acara_3: html.includes('_nama_acara_3'),
  form11733: html.includes('data-form-id="11733"'),
});
