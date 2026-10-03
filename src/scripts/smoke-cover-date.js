import { formatCoverDate, parseDateToISO } from '../parser/format.js';
import { parseGondongan } from '../parser/gondongan.js';

const messy = 'Sabtu & 24, oktober,2026';
console.log('direct', formatCoverDate(messy), parseDateToISO(messy));

const text = `Tema: Test
* Agama undangan: Islam
* Judul lagu: X
* Pakai amplop digital: Tidak
* Urutan nama di undangan terlebih dahulu: Wanita lebih dulu
(1) Wanita
• Nama lengkap: A Putri
• Nama panggilan: A
• Putri ke: 1
• Nama orang tua: Bpk X & Ibu Y
(2) Pria
• Nama lengkap: B Putra
• Nama panggilan: B
• Putra ke: 1
• Nama orang tua: Bpk X & Ibu Y
(3) Akad nikah
• Hari & tanggal: Sabtu & 24, oktober,2026
• Jam: 08.00-selesai WIB
• Tempat: Rumah
• Alamat: Desa X
(4) Resepsi
• Hari & tanggal: Sabtu & 24, oktober,2026
• Jam: 10.00-selesai WIB
• Tempat: Rumah
• Alamat: Desa X
`;

const { data, errors } = parseGondongan(text);
console.log('errors', errors);
console.log('cover', JSON.stringify(data.coverDateText));
console.log(
  'events',
  data.events.map((e) => ({ name: e.name, dateText: e.dateText, dateISO: e.dateISO })),
);
if (data.coverDateText !== 'Sabtu, 24 Oktober 2026') {
  throw new Error(`cover mismatch: ${data.coverDateText}`);
}
console.log('OK');
