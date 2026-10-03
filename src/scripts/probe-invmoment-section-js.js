import fs from 'node:fs';
import { switchSite } from '../config.js';
import { ZeyaAuth } from '../zeya/auth.js';

switchSite('invmoment');
const auth = new ZeyaAuth();
await auth.ensureLogin({ force: true });
const client = auth.getClient();
const html = fs.readFileSync('tmp-invmoment-edit-32851.html', 'utf8');
const srcs = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]);
console.log(
  'candidate scripts',
  srcs.filter((s) => /wds|wedding|invitation|edit|section|theme|dashboard/i.test(s)),
);

for (const src of srcs) {
  if (!/wds|wedding|section|invitation|dashboard|theme/i.test(src)) continue;
  let js = '';
  try {
    js = String((await client.get(src, { validateStatus: () => true })).data || '');
  } catch {
    continue;
  }
  if (
    js.includes('form--bride') ||
    js.includes('title_bride') ||
    js.includes('invitation_edit_section') ||
    js.includes('form--groom') ||
    js.includes('form--event')
  ) {
    console.log('\nHIT', src, 'len', js.length);
    for (const n of [
      'form--bride',
      'title_bride',
      'invitation_edit',
      'run_ajax(',
      'section_',
      'data-section',
    ]) {
      let from = 0;
      let c = 0;
      while (c < 2) {
        const i = js.indexOf(n, from);
        if (i < 0) break;
        c += 1;
        from = i + n.length;
        console.log(' ', n, '@', i, js.slice(Math.max(0, i - 100), i + 280).replace(/\s+/g, ' '));
      }
    }
    fs.writeFileSync('tmp-section-hit.js', js);
  }
}
