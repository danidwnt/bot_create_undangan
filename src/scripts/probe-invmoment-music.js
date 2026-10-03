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

// Find select with data-audio options
const selectIdx = html.search(/data-audio=["']/i);
console.log('data-audio idx', selectIdx);
if (selectIdx >= 0) {
  const before = html.slice(Math.max(0, selectIdx - 3000), selectIdx);
  const selOpen = before.lastIndexOf('<select');
  const chunk = before.slice(selOpen) + html.slice(selectIdx, selectIdx + 500);
  console.log('--- select chunk ---');
  console.log(chunk.slice(0, 1500));
  fs.writeFileSync('tmp-invmoment-music-select.html', chunk.slice(0, 5000));
}

// name near music / audio select
const names = [
  ...html.matchAll(/<select[^>]*name=["']([^"']+)["'][^>]*>[\s\S]{0,200}?data-audio=/gi),
].map((m) => m[1]);
console.log('select names with data-audio', [...new Set(names)]);

const audioNames = [
  ...html.matchAll(/name=["']([^"']*audio[^"']*)["']/gi),
  ...html.matchAll(/name=["']([^"']*music[^"']*)["']/gi),
  ...html.matchAll(/name=["']([^"']*lagu[^"']*)["']/gi),
  ...html.matchAll(/name=["']([^"']*backsound[^"']*)["']/gi),
].map((m) => m[1]);
console.log('name hits', [...new Set(audioNames)].slice(0, 40));

// Look in audio-processor / wds-dashboard for save action
for (const path of [
  '/wp-content/plugins/weddingsaas-pro/assets/js/audio-processor.js?v=2.9.2',
  '/wp-content/plugins/weddingsaas-pro/assets/js/wds-dashboard.js?v=2.9.2',
  '/wp-content/plugins/weddingsaas-pro/assets/js/wds.js?v=2.9.2',
]) {
  const js = String((await client.get(path, { validateStatus: () => true })).data || '');
  const pats = [
    'data-audio',
    'edit_music',
    'invitation_music',
    'save_music',
    'set_music',
    'selected_music',
    'wds_form_edit',
    'form_edit_music',
    'run_wds',
  ];
  console.log('\nFILE', path, 'len', js.length);
  for (const p of pats) {
    let from = 0;
    let count = 0;
    while (count < 3) {
      const i = js.indexOf(p, from);
      if (i < 0) break;
      count += 1;
      from = i + p.length;
      console.log(`  ${p}@${i}:`, js.slice(Math.max(0, i - 80), i + 220).replace(/\s+/g, ' '));
    }
    if (!count) console.log(`  ${p}: none`);
  }
}

// Try run_wds music-related names
const ajaxNonce =
  html.match(/["']ajax_nonce["']\s*:\s*["']([a-f0-9]+)["']/i)?.[1] || '';
const sampleUrl =
  html.match(/data-audio=["'](https?:\/\/[^"']+\.mp3)["']/i)?.[1] || '';
console.log('\nsample music', sampleUrl?.slice(0, 100), 'nonce', ajaxNonce);

const candidates = [
  'invitation_edit_music',
  'invitation_music',
  'edit_music',
  'form_edit_music',
  'wds_form_edit_music',
  'set_music',
  'save_music',
];

for (const name of candidates) {
  const body = new URLSearchParams({
    action: 'run_wds',
    name,
    __nonce: ajaxNonce,
    post_id: String(postId),
    selected: sampleUrl,
    music: sampleUrl,
    value: sampleUrl,
  });
  const r = await client.post('/wp-admin/admin-ajax.php', body.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest',
      Referer: `${config.zeya.baseUrl}/dashboard/invitation/edit/?id=${postId}`,
    },
    validateStatus: () => true,
  });
  const out =
    typeof r.data === 'string' ? r.data.slice(0, 180) : JSON.stringify(r.data).slice(0, 220);
  console.log('run_wds', name, r.status, out);
}

// Also legacy action
for (const action of ['wds_form_edit_music', 'weddingsaas_form_edit_music']) {
  const body = new URLSearchParams({
    action,
    post_id: String(postId),
    selected: sampleUrl,
    nonce: ajaxNonce,
  });
  const r = await client.post('/wp-admin/admin-ajax.php', body.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest',
      Referer: `${config.zeya.baseUrl}/dashboard/invitation/edit/?id=${postId}`,
    },
    validateStatus: () => true,
  });
  const out =
    typeof r.data === 'string' ? r.data.slice(0, 180) : JSON.stringify(r.data).slice(0, 220);
  console.log('action', action, r.status, out);
}
