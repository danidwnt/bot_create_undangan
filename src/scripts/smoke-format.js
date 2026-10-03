import {
  formatEventTime,
  formatParentsText,
  formatPersonName,
} from '../parser/format.js';
import { parseGondongan } from '../parser/gondongan.js';

const timeCases = [
  ['08.00-sampai selsai WIB', '08.00 WIB - Selesai'],
  ['09.00-sampai dengan selesai WIB', '09.00 WIB - Selesai'],
  ['08.00-10.00 WIB', '08.00 - 10.00 WIB'],
  ['08.00 - 10.00 WIB', '08.00 - 10.00 WIB'],
  ['Pukul 08.00 WIB', '08.00 WIB'],
];

let failed = 0;
for (const [input, expected] of timeCases) {
  const got = formatEventTime(input);
  if (got !== expected) {
    failed += 1;
    console.error('TIME FAIL', { input, got, expected });
  } else {
    console.log('TIME OK', got);
  }
}

const nameCases = [
  ['aldi saputra', 'Aldi Saputra'],
  ['Lala Novita, S. Ag', 'Lala Novita, S.Ag.'],
  ['edo syahputra', 'Edo Syahputra'],
  ['dr. andi', 'Dr. Andi'],
];

for (const [input, expected] of nameCases) {
  const got = formatPersonName(input);
  if (got !== expected) {
    failed += 1;
    console.error('NAME FAIL', { input, got, expected });
  } else {
    console.log('NAME OK', got);
  }
}

console.log(
  'PARENTS =>',
  formatParentsText('Bpk. Romli (alm) dan ibuk. Mulyana (R.m mang iwan)'),
);

const sample = `Tema: Haritage Palembang
Agama undangan: Islam
Judul lagu: Pagar pengantin
Link YouTube: https://youtu.be/x
Pakai amplop digital: Ya
Amplop digital (maks. 3):
(1)
Nama pemilik: lala novita
No rekening: 088286433559
Bank / e-wallet: Dana
(2)
Nama pemilik: edo syahputra
No rekening: 081271661979
Bank / e-wallet: Dana
Urutan nama di undangan terlebih dahulu: Wanita lebih dulu
(1) Wanita
Nama lengkap: Lala Novita, S. Ag
Nama panggilan: lala
Putri ke: 1
Nama orang tua: Bpk. Romli (alm) dan ibuk. Mulyana (R.m mang iwan)
(2) Pria
Nama lengkap: edo syahputra
Nama panggilan: edoh
Putra ke: 1
Nama orang tua: Bpk. Heriasyah amruluddin dan ibuk. Rosmiati
(3) Akad nikah
Hari & tanggal: Minggu, 22 November 2026
Jam: 08.00-sampai selsai WIB
Alamat: dusun 2, desa belimbing jaya kecamatan belimbing
Tempat: lapangan samping konter iluuscell atau dekat Rm. Mang iwan
Tautan (link) Google Maps: https://maps.app.goo.gl/xnXicErUT1WZgBSQ8
(4) Resepsi
Hari & tanggal: 22 November 2026
Jam: 09.00-10.00 WIB
Tempat: lapangan samping konter
Alamat: dusun 2
Tautan (link) Google Maps: https://maps.app.goo.gl/xnXicErUT1WZgBSQ8`;

const { data, errors } = parseGondongan(sample);
console.log('errors', errors);
console.log('bride', data.bride.fullName);
console.log('parents', data.bride.parents);
console.log('groom', data.groom.fullName);
console.log('time1', data.events[0].time);
console.log('time2', data.events[1].time);
console.log(
  'owners',
  data.accounts.map((a) => a.owner),
);

if (data.bride.fullName !== 'Lala Novita, S.Ag.') failed += 1;
if (data.groom.fullName !== 'Edo Syahputra') failed += 1;
if (data.events[0].time !== '08.00 WIB - Selesai') failed += 1;
if (data.events[1].time !== '09.00 - 10.00 WIB') failed += 1;

if (failed) {
  console.error('FAILED count', failed);
  process.exit(1);
}
console.log('Format rules OK');
