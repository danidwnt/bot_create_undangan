import { parseGondongan, looksLikeGondongan } from '../parser/gondongan.js';

const SAMPLE = `Bantu lengkapi kelengkapan untuk website ya kak
TEMA : Premium 3

Data Pengantin
* Kirim Foto (Max. 12): 
* Kirim Nama Lagu/Link Lagu di Youtube : https://youtu.be/QU-U5H39M_c?si=IPC8lPd4CtSyBJNc


* Kirim Nomer Rekening / Dana / Shopeepay (Amplop Online) :
> - PUTRI HARTATI
- Bank Mandiri
- 1120018621438

> RAJU SAPUTRA
 •  Bank Bca
 •8530167969

* Yang ditulis duluan nama Cewe/Cowo : Putri Hartati

1. CALON MEMPELAI WANITA
    * Nama Lengkap : Putri Hartati
    * Nama Panggilan : Putri
    - Putri ke : 4
    * Nama Ortu : Bpk Zulkifli (Alm) & Ibu Mutmaina 
    
2. CALON MEMPELAI PRIA
    * Nama Lengkap : Raju saputra
    * Nama Panggilan : Raju
    - Putra ke : 3
    * Nama Ortu : Bpk Herwanto (Alm) & ibu Elpi yani
    
3. AKAD NIKAH
    * Hari, Tanggal : Sabtu, 31 Oktober 2026
    * Jam : 09:00 wib s/d selesa
    * Alamat : Dusun II Desa Sinar Dewa Kec. Talang Ubi Kab. Pali
    * Tempat : Lapangan Desa Sinar Dewa
    * Link Google Maps : https://maps.app.goo.gl/XXaFDx9nHhJXAAwk9

4. RESEPSI
    * Hari, Tanggal : Sabtu, 31 Oktober 2026
    * Jam : 10.00 wib s/d selesai
    * Tempat : Lapangan Desa Sinar Dewa
    * Alamat : Dusun II Desa Sinar Dewa Kec. Talang Ubi Kab. Pali
    * Link Google Maps : https://maps.app.goo.gl/XXaFDx9nHhJXAAwk9

Catatan :
- Jika Undangan Telah Diproses Pembuatan Maka Tidak Bisa Di Batalkan . 
- Undangan Akan Dibuat Sesuai Contoh Demonya


Jika Setuju Silakan Isi datanya Terima kasih 🙏`;

if (!looksLikeGondongan(SAMPLE)) throw new Error('looksLikeGondongan false');

const { data, errors } = parseGondongan(SAMPLE);
console.log(JSON.stringify({ errors, title: data.title, slug: data.slug, theme: data.themeName, cover: data.coverDateText, countdown: data.coverDateTime, youtube: data.youtube, nameOrder: data.nameOrder, bride: data.bride, groom: data.groom, events: data.events, accounts: data.accounts }, null, 2));

if (errors.length) throw new Error(errors.join('; '));
if (data.themeName !== 'Premium 3') throw new Error(`theme: ${data.themeName}`);
if (data.title !== 'Putri & Raju') throw new Error(`title: ${data.title}`);
if (data.bride.fullName !== 'Putri Hartati') throw new Error(`bride: ${data.bride.fullName}`);
if (data.groom.fullName !== 'Raju Saputra') throw new Error(`groom: ${data.groom.fullName}`);
if (!/Bpk\.\s*Zulkifli \(Alm\.\)/.test(data.bride.parents)) {
  throw new Error(`bride parents: ${data.bride.parents}`);
}
if (!/Ibu\s*Elpi Yani/i.test(data.groom.parents)) {
  throw new Error(`groom parents: ${data.groom.parents}`);
}
if (data.events.length < 2) throw new Error('events missing');
if (data.events[0].time !== '09.00 WIB - Selesai') throw new Error(`akad time: ${data.events[0].time}`);
if (data.events[1].time !== '10.00 WIB - Selesai') throw new Error(`resepsi time: ${data.events[1].time}`);
if (data.coverDateText !== 'Sabtu, 31 Oktober 2026') throw new Error(`cover: ${data.coverDateText}`);
if (data.accounts.length !== 2) throw new Error(`accounts: ${data.accounts.length}`);
if (data.accounts[0].bank !== 'Mandiri' || data.accounts[0].number !== '1120018621438') {
  throw new Error(`acc1: ${JSON.stringify(data.accounts[0])}`);
}
if (data.accounts[1].bank !== 'BCA' || data.accounts[1].number !== '8530167969') {
  throw new Error(`acc2: ${JSON.stringify(data.accounts[1])}`);
}
if (!/youtu\.be\/QU-U5H39M_c/i.test(data.youtube)) throw new Error(`youtube: ${data.youtube}`);

console.log('Kelengkapan format OK');
