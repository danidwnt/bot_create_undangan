import fs from 'node:fs';
import axios from 'axios';

const h = fs.readFileSync('tmp-invmoment-login.html', 'utf8');
const scripts = [...h.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]);
console.log(scripts.join('\n'));

const authJs = scripts.find((s) => /auth|wds|custom/i.test(s)) || scripts.find((s) => /main|app|scripts/i.test(s));
const candidates = scripts.filter((s) => /wds|auth|wedding|dashboard|scripts\.min|custom/i.test(s));
console.log('candidates', candidates);

for (const url of candidates.slice(0, 5)) {
  const abs = url.startsWith('http') ? url : `https://invmoment.my.id${url}`;
  try {
    const r = await axios.get(abs, { timeout: 20000, validateStatus: () => true });
    const body = String(r.data || '');
    if (/login_ajax|wds_auth|ajax_nonce|__nonce/i.test(body)) {
      console.log('\nHIT', abs, body.length);
      const idx = body.search(/login_ajax|wds_auth_submit|action.*login/i);
      console.log(body.slice(Math.max(0, idx - 200), idx + 600));
    } else {
      console.log('no login in', abs, body.length);
    }
  } catch (e) {
    console.log('fail', abs, e.message);
  }
}
