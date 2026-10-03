import fs from 'node:fs';

const html = fs.readFileSync('tmp-invmoment-edit.html', 'utf8');

const forms = [];
const re = /<form\b([^>]*)>([\s\S]*?)<\/form>/gi;
let m;
while ((m = re.exec(html))) {
  const attrs = m[1];
  const body = m[2];
  const id = (attrs.match(/data-form-id=["'](\d+)/i) || [])[1];
  if (!id) continue;
  const action = (attrs.match(/action=["']([^"']+)/i) || [])[1] || '';
  const cls = (attrs.match(/class=["']([^"']+)/i) || [])[1] || '';
  const names = [...body.matchAll(/name=["']([^"']+)["']/gi)].map((x) => x[1]);
  const interesting = names.filter(
    (n) =>
      !n.startsWith('_jfb') &&
      !n.startsWith('_jet') &&
      n !== '__queried_post_id' &&
      n !== 'post_id' &&
      !n.includes('render'),
  );
  forms.push({
    id,
    action: action.replace(/&amp;/g, '&').slice(0, 160),
    submitType: (cls.match(/submit-type-(\w+)/) || [])[1] || '',
    fields: interesting.slice(0, 30),
  });
}

console.log('=== FORMS ===');
for (const f of forms) {
  console.log(`\n#${f.id} submit=${f.submitType || '?'} action=${f.action}`);
  console.log('  fields:', f.fields.join(', ') || '(none)');
}

const keyFields = [
  'judul_undangan',
  '_meta_judul',
  '_nama_lengkap_wanita',
  '_nama_lengkap_pria',
  '_nama_acara_1',
  '_nama_bank_1',
  '_judul_cerita_1',
  '_teks_quotes',
  '_teks_pembuka',
];

console.log('\n=== FIELD → FORM ID ===');
for (const field of keyFields) {
  const idx = html.search(new RegExp(`name=["']${field}["']`, 'i'));
  if (idx < 0) {
    console.log(field, '→ NOT FOUND');
    continue;
  }
  const before = html.slice(Math.max(0, idx - 4000), idx);
  const formOpen = before.lastIndexOf('<form');
  const chunk = before.slice(formOpen);
  const fid = (chunk.match(/data-form-id=["'](\d+)["']/) || [])[1];
  console.log(field, '→', fid || '?');
}

console.log('\n=== REST / AJAX HINTS ===');
const pats = [
  /wp-json\/[^"'\\\s]+/gi,
  /jet-form-builder\/v\d\/[^"'\\\s]+/gi,
  /admin-ajax\.php[^"'\\\s]*/gi,
  /run_wds[^"'\\\s]*/gi,
  /wds_form_edit[^"'\\\s]*/gi,
  /method=ajax[^"'\\\s]*/gi,
  /ssr_validation_method=["'][^"']+/gi,
  /submit-type-\w+/gi,
];
for (const p of pats) {
  const hits = [...new Set([...html.matchAll(p)].map((x) => x[0]))].slice(0, 12);
  if (hits.length) console.log(p.source.slice(0, 40), hits);
}

console.log('\n=== MUSIC / NONCE IN SCRIPT ===');
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map((s) => s[1]);
for (const s of scripts) {
  if (!/music|nonce|wds_form|ajax/i.test(s)) continue;
  const lines = s
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => /music|nonce|wds_form|formData\.append|admin-ajax|ajax_nonce|selected/i.test(l))
    .slice(0, 20);
  if (lines.length) {
    console.log('--- script hit ---');
    console.log(lines.join('\n').slice(0, 1200));
  }
}

// External script src with jet-form / wds
const srcs = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map((x) => x[1]);
console.log(
  '\n=== SCRIPT SRCS (filtered) ===\n',
  srcs.filter((u) => /jet-form|wds|wedding|invitation|music|edit/i.test(u)).slice(0, 40),
);

// Localized WP data
const localized = [...html.matchAll(/var\s+(\w+)\s*=\s*(\{[\s\S]*?\});/g)].slice(0, 30);
for (const loc of localized) {
  if (/nonce|ajax|music|form|wds/i.test(loc[0])) {
    console.log('\nVAR', loc[1], loc[2].slice(0, 400));
  }
}

const wpApiSettings = html.match(/wpApiSettings\s*=\s*(\{[\s\S]*?\});/);
if (wpApiSettings) console.log('\nwpApiSettings', wpApiSettings[1].slice(0, 300));

const jetForm = html.match(/JetFormBuilderSettings\s*=\s*(\{[\s\S]*?\});/i)
  || html.match(/JetFormBuilder[\w]*\s*=\s*(\{[\s\S]*?\});/i);
if (jetForm) console.log('\nJetForm settings', jetForm[0].slice(0, 500));
