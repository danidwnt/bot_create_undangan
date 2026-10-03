import { parseGondongan } from '../parser/gondongan.js';

const text = `Data undangan digital — mohon digunakan sebagai acuan pembuatan

Tema: Adat Palembang
* Agama undangan: Islam

Data pengantin
* Judul lagu: Berpayung Tuhan
* Link YouTube: https://youtu.be/bxPMBFV0df8?si=SiQm6Ux3iBHideZi
* Pakai amplop digital: Ya
* Amplop digital (maks. 3):
    (1)
    • Nama pemilik: Maleha Putri Amara Zofa
    • No rekening: 145201007716503
    • Bank / e-wallet: BRI
    (2)
    • Nama pemilik: Richo Nopan Saputra
    • No rekening: 110301021194500
    • Bank / e-wallet: BRI
* Urutan nama di undangan terlebih dahulu: Wanita lebih dulu

(1) Wanita
    • Nama lengkap: Maleha Putri Amara Zofa, Amd. RMIK
    • Nama panggilan: Amel
    • Putri ke: 1
    • Nama orang tua: Bpk Agus Satriawan & Ibu Asmunah, SKM

(2) Pria
    • Nama lengkap: Richo Nopan Saputra
    • Nama panggilan: Richo
    • Putra ke: 2
    • Nama orang tua: Bpk Sukril Hadi & Ibu Rila Wati

(3) Akad nikah
    • Hari & tanggal: Sabtu, 07 November 2026
    • Jam: 07.30-10.00 WIB
    • Alamat: Dusun IV desa kemu ulu Kec. Pulau Beringin Kab. Oku Selatan
    • Tempat: Kediaman mempelai wanita
    • Tautan (link) Google Maps: https://maps.app.goo.gl/et8v7iRzCVXAz5RD9?g_st=ic

(4) Resepsi
    • Hari & tanggal: Sabtu 07 November 2026
    • Jam: 10.00-selesai WIB
    • Tempat: Kediaman mempelai wanita
    • Alamat: Dusun IV desa kemu ulu Kec. Pulau Beringin Kab. Oku Selatan
    • Tautan (link) Google Maps: https://maps.app.goo.gl/et8v7iRzCVXAz5RD9?g_st=ic

(5) Ngunduh mantu
    • Hari & tanggal: Minggu, 08 November 2026
    • Jam: 08.00-selesai WIB
    • Tempat: Kediaman mempelai laki laki
    • Alamat: Desa Kemu Kec. Pulau Beringin Kab. Oku Selatan
    • Tautan (link) Google Maps: https://maps.app.goo.gl/ovTL7FyrgsTLHEFAA?g_st=ic

Catatan:
* Pesanan yang sudah dalam proses pembuatan tidak dapat dibatalkan.
`;

const { data, errors } = parseGondongan(text);
console.log('errors', errors);
console.log('events', data.events.map((e) => ({ name: e.name, date: e.dateText || e.dateISO, place: e.place })));
