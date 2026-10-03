# Panduan Pemakaian Bot (WhatsApp)

Panduan ini untuk **pakai bot lewat chat WhatsApp**.  
Bot sudah harus jalan (`npm start` + QR sudah discan).

---

## Nomor bot vs nomor admin (biar tidak bingung)

Di setup kamu, **biasanya nomornya sama** — itu yang bikin bingung.

| Istilah | Artinya | Di mana diatur |
|---|---|---|
| **Nomor bot** | Nomor WhatsApp yang **scan QR** saat `npm start`. Itu “akun” bot yang online. | Tidak di `.env` — dari HP yang scan QR |
| **Nomor admin** | Nomor yang **boleh kasih perintah** (`/buat`, `/update`, dll.). | `.env` → `ADMIN_NUMBERS` |

### Cara pakai yang kamu pakai sekarang (1 nomor)

1. Scan QR dengan WhatsApp **6289630376423**
2. Di `.env` juga `ADMIN_NUMBERS=6289630376423`
3. Chat ke **diri sendiri** (Saved Messages / chat ke nomor sendiri)
4. Ketik perintah di situ, contoh `/buat`

Jadi: **bot = admin = nomor yang sama**. Tidak perlu HP kedua.

```
HP kamu (62896...)  --scan QR-->  Bot jalan di komputer
       ↑
       nomor yang sama juga di ADMIN_NUMBERS
       ↑
Kamu chat ke nomor sendiri → bot balas di chat itu
```

### Kalau nanti mau beda nomor (opsional)

| Peran | Contoh |
|---|---|
| Bot | HP A scan QR (mis. `628111...`) |
| Admin | HP B chat ke nomor bot, dan `ADMIN_NUMBERS=628222...` |

Hanya nomor yang ada di `ADMIN_NUMBERS` yang dilayani. Orang lain chat ke bot → diabaikan.

### Yang sering salah

- Chat dari nomor **lain** yang tidak ada di `ADMIN_NUMBERS` → bot diam  
- Tulis `08...` di `.env` → ubah ke `628...` (tanpa `+`)  
- Chat di **grup** → bot tidak respons (hanya chat privat)

---

## Aturan penting

1. **Wajib `/start` dulu** sebelum perintah lain. Tanpa itu bot diam (kecuali `/start`).
2. `/stop` mematikan bot + membersihkan draft. Aktifkan lagi dengan `/start`.
3. Kalau ada **lebih dari 1 akun website**, pilih dulu: `/akun` lalu `/akun 2`
4. Jangan paste data sembarangan — **selalu mulai dari perintah** dulu.
5. Setelah restart proses Node, tunggu **Bot siap menerima perintah.** lalu ketik `/start` (state aktif/mati tersimpan di `sessions/bot-state.json`).
6. Foto / video **tidak** memicu bot (aman dikirim).
7. Konfirmasi: `YA` · Batalkan: `BATAL`

---

## 0. Pilih akun login website

Bot bisa pakai beberapa akun zeyainvitation. Sebelum buat/update undangan, pilih akun yang dipakai.

```
/akun
```

Contoh balasan:
```
👉 1. Utama — yo***@gmail.com *(aktif)*
• 2. Cabang — la***@gmail.com
```

Ganti akun:

```
/akun 2
```

atau:

```
/akun Cabang
```

Cek status:

```
/status
```

Login ulang akun aktif:

```
/login
```

---

## 1. Buat undangan baru

```
/buat
```

Lalu:
1. Paste data gondongan lengkap (**satu pesan**)
2. Cek ringkasan
3. Balas `YA`

Bot akan buat undangan + isi form, lalu kirim pesan hasil siap forward ke customer.

---

## 2. Update undangan yang sudah ada

Slug/link **tetap**. Tema/template **tidak diganti**. Foto & YouTube **tidak diubah otomatis**.

```
/update amel-richo
```

atau:

```
/update 136941
```

Lalu:
1. Paste data gondongan baru
2. Cek ringkasan
3. Balas `YA`

---

## 3. Love story (terpisah)

Tidak ikut `/buat` atau `/update`.

```
/love-story amel-richo
```

(boleh juga `/cerita amel-richo`)

Lalu paste teks love story. **Setiap judul wajib `(JUDUL)`:**

```
2013 — Awal Sebuah Cerita (JUDUL)
isi paragraf...

2024 — Dipertemukan Kembali (JUDUL)
isi paragraf...

Lamaran — Sebuah Janji (JUDUL)
isi paragraf...

Pernikahan — Awal Selamanya (JUDUL)
isi paragraf...
```

Cek ringkasan → `YA`

---

## 4. Tukar posisi nama (template terbalik)

Tanpa kirim data ulang:

```
/tukar amel-richo
```

Atau saat ringkasan gondongan sudah muncul (sebelum `YA`):

```
/tukar
```

---

## 5. Pesan hasil ke customer

Otomatis terkirim setelah buat/update sukses.

Kirim ulang manual:

```
/hasil amel-richo
```

(boleh juga `/kirim amel-richo`)

Isi pesan: link undangan, link input nama tamu, tutorial, RSVP + password `123456`.

---

## 6. Link personal tamu

```
/link amel-richo | Andi Prasetyo, Budi Santoso
```

atau:

```
/link amel-richo
```

lalu kirim daftar nama.

---

## 7. Perintah lain

| Perintah | Fungsi |
|---|---|
| `/start` | Aktifkan bot (wajib sebelum perintah lain) |
| `/stop` | Matikan bot — semua perintah diabaikan |
| `/ping` | Cek bot hidup |
| `/help` | Bantuan singkat |
| `/status` | Status WA + website + akun aktif |
| `/akun` | Daftar akun website |
| `/akun 2` | Pilih akun (nomor / label) |
| `/login` | Login ulang akun aktif |
| `/kategori` | Daftar kategori template |
| `/templates 156` | Daftar template |
| `YA` | Konfirmasi |
| `BATAL` | Batalkan draft |

---

## Checklist orderan

1. `/start` (kalau belum aktif)
2. (Kalau multi-akun) `/akun` → `/akun 2`
3. `/buat` → paste data → `YA`
4. Forward pesan **Hallo kak** ke customer
5. Upload **foto** manual di dashboard
6. (Opsional) `/love-story {slug}` → paste cerita → `YA`
7. (Opsional) `/tukar {slug}` jika posisi nama terbalik
8. Selesai

---

## Mapping acara (otomatis)

| Di gondongan | Di form |
|---|---|
| Akad | Acara 1 |
| Resepsi | Acara 2 + Tanggal Cover |
| Ngunduh Mantu | Acara 3 |

---

## Yang manual (bot tidak isi)

- Foto
- Link YouTube / video

---

## Masalah umum

| Masalah | Solusi |
|---|---|
| Bot diam | Cek nomor admin, chat privat, pastikan bot sudah “siap” |
| Nama terbalik di template | `/tukar {slug}` |
| Love story tidak kebaca | Pastikan ada `(JUDUL)` di setiap judul |
| Mau ubah data undangan lama | `/update {slug}` lalu paste gondongan |
| Mau pesan hasil lagi | `/hasil {slug}` |
