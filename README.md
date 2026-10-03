# Bot Undangan WhatsApp — Setup Project

Dokumentasi **install & menjalankan** bot.  
Untuk **cara pakai di WhatsApp**, lihat **[PANDUAN-WA.md](./PANDUAN-WA.md)**.

---

## Persyaratan

- Node.js 18+
- Akun [zeyainvitation.com](https://zeyainvitation.com)
- Nomor WhatsApp untuk scan QR

---

## Install

```bash
npm install
copy .env.example .env
```

Edit `.env`:

```env
ZEYA_EMAIL=email-akun@gmail.com
ZEYA_PASSWORD=password-anda
ZEYA_LABEL=Utama

# Akun kedua (opsional)
# ZEYA_EMAIL_2=akun2@gmail.com
# ZEYA_PASSWORD_2=password2
# ZEYA_LABEL_2=Cabang

ZEYA_BASE_URL=https://zeyainvitation.com
ADMIN_NUMBERS=6281234567890
ZEYA_GUEST_TUTORIAL_URL=https://bit.ly/4ey9T4W
LOG_LEVEL=info
```

`ADMIN_NUMBERS` = nomor yang boleh kasih perintah.  
Nomor bot = nomor yang scan QR. **Boleh sama** (chat ke diri sendiri).  

Multi-akun website: isi `ZEYA_EMAIL_2`, lalu di WA pilih dengan `/akun`. Detail: [PANDUAN-WA.md](./PANDUAN-WA.md).

---

## Jalankan

```bash
npm start
```

1. Scan QR WhatsApp
2. Tunggu `WhatsApp connected`
3. Tunggu **±10 detik** sampai `Bot siap menerima perintah.`
4. Biarkan terminal tetap terbuka

Session:
- `sessions/wa/` — WhatsApp
- `sessions/zeya/` — cookie website

---

## Script uji (opsional)

```bash
npm run test:parser
npm run test:love-story
npm run test:zeya
```

---

## Keamanan

- Jangan share `.env`
- Jangan commit `sessions/`
- Hanya nomor di `ADMIN_NUMBERS` yang bisa kontrol bot

---

## Lanjut pakai di WA

Buka **[PANDUAN-WA.md](./PANDUAN-WA.md)** — perintah chat, gondongan, love story, update, hasil, dll.
