import fs from 'node:fs';
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

const idx = html.indexOf('id="audio"');
console.log('audio block:\n', html.slice(Math.max(0, idx - 800), idx + 2500));
fs.writeFileSync('tmp-invmoment-audio-block.html', html.slice(Math.max(0, idx - 1500), idx + 4000));

// Search scripts.bundle and wds-dashboard for #audio or invitation_audio
const urls = [
  'https://assets.weddingsaas.id/js/scripts.bundle.js',
  `${config.zeya.baseUrl}/wp-content/plugins/weddingsaas-pro/assets/js/wds-dashboard.js?v=2.9.2`,
  `${config.zeya.baseUrl}/wp-content/plugins/weddingsaas-pro/assets/js/audio-trimmer.js?v=2.9.2`,
  `${config.zeya.baseUrl}/wp-content/plugins/weddingsaas-pro/assets/js/audio-processor.js?v=2.9.2`,
];

for (const url of urls) {
  const js = String((await client.get(url, { validateStatus: () => true })).data || '');
  console.log('\n===', url, 'len', js.length);
  for (const p of [
    '#audio',
    'id="audio"',
    'audio_youtube',
    'invitation_audio',
    'audio_custom',
    'Pilih audio',
    'data-audio',
    'selected_audio',
    'save_audio',
    'edit_audio',
    'form_edit_audio',
    'wds_audio',
  ]) {
    const i = js.indexOf(p);
    if (i >= 0) {
      console.log(p, '@', i, js.slice(Math.max(0, i - 120), i + 300).replace(/\s+/g, ' '));
    }
  }
}

// Grep html for btn near audio section keywords
for (const p of [
  'btn-save-audio',
  'save-audio',
  'update-audio',
  'audio_submit',
  'name="audio"',
  'invitation_update_audio',
  'update_audio',
  'set_audio',
]) {
  console.log('html', p, html.includes(p));
}

// Extract nearby buttons text
const block = html.slice(Math.max(0, idx - 2000), idx + 5000);
const btns = [...block.matchAll(/<(button|a)[^>]*>[\s\S]*?<\/\1>/gi)]
  .map((m) => m[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
  .filter(Boolean)
  .slice(0, 20);
console.log('buttons near audio', btns);

const onclicks = [...block.matchAll(/data-name=["']([^"']+)["']/gi)].map((m) => m[1]);
const actions = [...block.matchAll(/name=["']([a-z_]*audio[a-z_]*)["']/gi)].map((m) => m[1]);
console.log('data-name', onclicks);
console.log('audio names in block', [...new Set(actions)]);
