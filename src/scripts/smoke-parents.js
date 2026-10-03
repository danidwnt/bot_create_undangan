import { formatParentsText } from '../parser/format.js';

const cases = [
  ['(ALM) pairis nedi & Titin Sumantri.', '(Alm.) Bpk. Pairis Nedi & Ibu Titin Sumantri'],
  ["Mu'aridin &Aryanti", "Bpk. Mu'aridin & Ibu Aryanti"],
  [
    'Bpk. Romli (alm) dan ibuk. Mulyana (R.m mang iwan)',
    'Bpk. Romli (Alm.) dan Ibu Mulyana (Rm. Mang Iwan)',
  ],
  ['alm. pairis nedi & titin sumantri', '(Alm.) Bpk. Pairis Nedi & Ibu Titin Sumantri'],
  ['(Almh) siti & budi', '(Almh.) Bpk. Siti & Ibu Budi'],
];

let failed = 0;
for (const [input, expected] of cases) {
  const got = formatParentsText(input);
  const ok = got === expected;
  console.log(ok ? 'OK' : 'FAIL', JSON.stringify(input), '=>', JSON.stringify(got));
  if (!ok) {
    console.log('  expected', JSON.stringify(expected));
    failed += 1;
  }
}

if (failed) {
  console.error('FAILED', failed);
  process.exit(1);
}
console.log('Parents OK');
