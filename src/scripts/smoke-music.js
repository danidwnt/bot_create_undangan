import fs from 'node:fs';
import { pickMusicUrl } from '../zeya/resolve.js';

const html = fs.readFileSync('tmp-edit-probe.html', 'utf8');

const cases = [
  'Di ahkir perang(NADIN AMIZAH)',
  'Di Akhir Perang (NADIN AMIZAH)',
  'Nadin Amizah – Di Akhir Perang',
  'Pagar Pengantin',
];

for (const title of cases) {
  const url = pickMusicUrl(html, title);
  console.log(JSON.stringify(title), '=>', url ? url.split('/').pop() : '(tidak ketemu)');
  if (!url && /akhir|ahkir|pagar/i.test(title)) {
    throw new Error(`Gagal resolve: ${title}`);
  }
}

console.log('OK');
