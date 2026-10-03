import { config } from '../config.js';
import { buildGuestLink } from './invitation.js';

export function buildShareGuestInputLink(slug) {
  const cleanSlug = String(slug || '')
    .trim()
    .replace(/^\/+|\/+$/g, '');
  return `${config.zeya.baseUrl}/share/?id=${encodeURIComponent(cleanSlug)}`;
}

export function buildRsvpLink(postId) {
  const id = String(postId || '').trim();
  return `${config.zeya.baseUrl}/public/rsvp/?id=${encodeURIComponent(id)}`;
}

/** Link undangan dengan placeholder tamu (Nama+Tamu) */
export function buildSampleGuestInvitationLink(slug, guestName = 'Nama Tamu') {
  return buildGuestLink(slug, guestName).replace(/%20/g, '+');
}

/**
 * Pesan siap kirim ke customer (format standar).
 */
const RSVP_PASSWORD = '123456';

export function formatDeliveryMessage({
  slug,
  postId,
  guestName = 'Nama Tamu',
} = {}) {
  const cleanSlug = String(slug || '').trim();
  const id = String(postId || '').trim();
  const inviteLink = buildSampleGuestInvitationLink(cleanSlug, guestName);
  const shareLink = buildShareGuestInputLink(cleanSlug);
  const rsvpLink = buildRsvpLink(id);
  const tutorialUrl = config.zeya.guestTutorialUrl;

  const lines = [
    '- Hallo kak',
    '',
    'Ini hasil undangannya ya kak',
    '',
    'Link Undangan :',
    '',
    `👉 ${inviteLink}`,
    '',
    'Berikut merupakan link untuk menambahkan nama tamu :',
    '',
    'Link Input Nama Tamu :',
    '',
    `👉 ${shareLink}`,
    '',
    'Cara Input nama tamu :',
    '',
    '1. Klik Link Input Nama Tamu',
    '2. Masukkan nama tamu',
    '3. Klik Buat Link Undangan',
    '4. Klik Bagikan Via WA / Sosmed',
    '',
    'Klik Link Vidio Dibawah Tutorial Input Nama Tamu & Share',
    '',
    `👉 ${tutorialUrl}`,
  ];

  if (id) {
    lines.push(
      '',
      'Pantau Ucapan & Kehadiran tamu:',
      '',
      `👉 ${rsvpLink}`,
      `👉 Password: ${RSVP_PASSWORD}`,
    );
  }

  lines.push('', 'Mohon buka LINK melalui Google Chrome.');

  return lines.join('\n');
}
