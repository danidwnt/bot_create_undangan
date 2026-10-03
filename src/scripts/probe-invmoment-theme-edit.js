import fs from 'node:fs';
import { switchSite, config } from '../config.js';
import { ZeyaAuth } from '../zeya/auth.js';

switchSite('invmoment');
const auth = new ZeyaAuth();
await auth.ensureLogin({ force: true });
const client = auth.getClient();
const js = String(
  (
    await client.get(
      '/wp-content/themes/weddingsaas-wp/assets/js/edit.js?v=2.0.11',
      { validateStatus: () => true },
    )
  ).data || '',
);
fs.writeFileSync('tmp-theme-edit.js', js);

// Pretty-ish dump of run_theme and each section_* function names + first call
console.log('len', js.length);
const runThemeDef = js.indexOf('function run_theme') >= 0
  ? js.indexOf('function run_theme')
  : js.indexOf('run_theme=function') >= 0
    ? js.indexOf('run_theme=function')
    : js.indexOf('run_theme');
console.log('run_theme context:\n', js.slice(runThemeDef, runThemeDef + 500));

const sectionFns = [...js.matchAll(/function\s+(section_\w+)\s*\(/g)].map((m) => m[1]);
console.log('section fns', sectionFns);

for (const name of [
  'section_bride',
  'section_groom',
  'section_event',
  'section_gift',
  'section_general',
]) {
  const marker = `function ${name}`;
  const i = js.indexOf(marker);
  if (i < 0) {
    console.log('\n?', name, 'not as function');
    continue;
  }
  console.log('\n===', name, '===');
  console.log(js.slice(i, i + 900));
}

// All run_theme("...") names
const actions = [...js.matchAll(/run_theme\(\s*["']([^"']+)["']/g)].map((m) => m[1]);
console.log('\nrun_theme actions', [...new Set(actions)]);

// Probe HTML field names for key sections
const html = fs.readFileSync('tmp-invmoment-edit-32851.html', 'utf8');
for (const formId of [
  'form--bride',
  'form--groom',
  'form--event',
  'form--gift',
  'form--opening',
  'form--greeting',
  'form--quotes',
  'form--thanks',
]) {
  const re = new RegExp(`<form[^>]*id=["']${formId}["'][^>]*>([\\s\\S]*?)<\\/form>`, 'i');
  const body = html.match(re)?.[1] || '';
  const names = [...body.matchAll(/name=["']([^"']+)["']/gi)].map((m) => m[1]);
  console.log('\n', formId, [...new Set(names)].join(', '));
}

// Also general settings / title outside sections
const generalNames = [...html.matchAll(/name=["']([^"']+)["']/gi)]
  .map((m) => m[1])
  .filter((n) => /title|slug|meta|countdown|date|cover|audio/i.test(n));
console.log('\ngeneral-ish names', [...new Set(generalNames)].slice(0, 40));
