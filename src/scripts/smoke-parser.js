import {
  formatGondonganSummary,
  looksLikeGondongan,
  parseGondongan,
} from '../parser/gondongan.js';

const SAMPLE = `Data undangan digital — mohon digunakan sebagai acuan pembuatan

Tema: Haritage Palembang
* Agama undangan: Islam

Data pengantin
* Foto: kirim manual via WhatsApp, maks. 12 foto (format WA HD, bukan Google Drive/file)
* Judul lagu: Pagar pengantin
* Link YouTube: https://youtu.be/M6VbTwKbIi0?si=9cky-dUDI4RsN0m8
* Pakai amplop digital: Ya
* Amplop digital (maks. 3):
    (1)
    • Nama pemilik: Lala novita
    • No rekening: 088286433559
    • Bank / e-wallet: Dana
    (2)
    • Nama pemilik: Edo syahputra
    • No rekening: 081271661979
    • Bank / e-wallet: Dana
    (3)
    • Nama pemilik: Lala novita
    • No rekening: 0128 0107 4008 503
    • Bank / e-wallet: Bank BRI
* Urutan nama di undangan terlebih dahulu: Wanita lebih dulu


(1) Wanita
    • Nama lengkap: Lala Novita, S. Ag
    • Nama panggilan: Lala
    • Putri ke: 1
    • Nama orang tua: Bpk. Romli (alm) dan ibuk. Mulyana (R.m mang iwan)

(2) Pria
    • Nama lengkap: Edo syahputra
    • Nama panggilan: Edoh
    • Putra ke: 1
    • Nama orang tua: Bpk. Heriasyah amruluddin dan ibuk. Rosmiati

(3) Akad nikah
    • Hari & tanggal: Minggu, 22 November 2026
    • Jam: 08.00-sampai selsai WIB
    • Alamat: Dusun 2, desa belimbing jaya kecamatan belimbing
    • Tempat: Lapangan Samping konter iluuscell atau dekat Rm. Mang iwan
    • Tautan (link) Google Maps: https://maps.app.goo.gl/xnXicErUT1WZgBSQ8

(4) Resepsi
    • Hari & tanggal: 22 November 2026
    • Jam: 09.00-sampai dengan selesai WIB
    • Tempat: Lapangan Samping konter iluuscell atau dekat Rm. Mang iwan
    • Alamat: Dusun 2, desa belimbing jaya kecamatan belimbing
    • Tautan (link) Google Maps: https://maps.app.goo.gl/xnXicErUT1WZgBSQ8

(5) Ngunduh mantu
    • Hari & tanggal: -
    • Jam: -
    • Tempat: -
    • Alamat: -
    • Tautan (link) Google Maps: -`;

const { data, errors, warnings } = parseGondongan(SAMPLE);
console.log('looksLike:', looksLikeGondongan(SAMPLE));
console.log('errors:', errors);
console.log('warnings:', warnings);
console.log('summary:\n' + formatGondonganSummary(data));
console.log('data snapshot:', {
  title: data.title,
  slug: data.slug,
  themeName: data.themeName,
  musicTitle: data.musicTitle,
  youtube: data.youtube,
  bride: data.bride,
  groom: data.groom,
  events: data.events,
  accounts: data.accounts,
});

if (errors.length) process.exit(1);
if (!/^Lala & Edo/i.test(data.title.replace('Edoh', 'Edo'))) {
  // Allow Lala & Edoh (panggilan) or Lala & Edo
  if (!/^Lala & Edo/i.test(data.title) && data.title !== 'Lala & Edoh') {
    throw new Error(`title mismatch: ${data.title}`);
  }
}
if (!/^lala-edo/i.test(data.slug.replace('edoh', 'edo'))) {
  if (data.slug !== 'lala-edo' && data.slug !== 'lala-edoh') {
    throw new Error(`slug mismatch: ${data.slug}`);
  }
}
if (data.events.length < 2) throw new Error('events missing');
if (data.accounts.length !== 3) throw new Error(`accounts missing: ${data.accounts.length}`);
console.log('Parser smoke OK');
