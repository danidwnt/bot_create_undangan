import fs from 'node:fs';
import { switchSite } from '../config.js';
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
fs.writeFileSync('tmp-invmoment-edit-32851.html', html);

const clues = [
  'jet-form-builder',
  'Belum ada',
  'aktifkan',
  'activate',
  'lengkapi',
  'theme',
  'template',
  'Premium',
  'alert',
  'empty',
  'kosong',
  'draft',
  'publish',
  'data-form-id',
  'invitation/edit',
];
for (const c of clues) {
  console.log(c, html.toLowerCase().includes(c.toLowerCase()));
}

// Extract main alerts / empty states
const texts = [...html.matchAll(/<(?:div|p|h[1-6]|span)[^>]*class=["'][^"']*(?:alert|notice|empty|info|warning)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|p|h[1-6]|span)>/gi)]
  .map((m) => m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
  .filter((t) => t.length > 5 && t.length < 200)
  .slice(0, 20);
console.log('notices', texts);

const titles = [...html.matchAll(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi)]
  .map((m) => m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
  .filter(Boolean)
  .slice(0, 30);
console.log('headings', titles);

// Compare create flow - does createInvitation wait for redirect properly?
console.log('body class?', html.match(/<body[^>]*class=["']([^"']+)/i)?.[1]?.slice(0, 120));
