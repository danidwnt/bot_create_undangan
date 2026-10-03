import fs from 'node:fs';
import path from 'node:path';
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { config } from '../config.js';

function ensureSessionDir() {
  fs.mkdirSync(config.paths.waSession, { recursive: true });
  const keep = path.join(config.paths.waSession, '.gitkeep');
  if (!fs.existsSync(keep)) {
    fs.writeFileSync(keep, '');
  }
}

export async function startWhatsApp({ onMessage, logger = console } = {}) {
  ensureSessionDir();

  const { state, saveCreds } = await useMultiFileAuthState(config.paths.waSession);
  const { version } = await fetchLatestBaileysVersion();

  /**
   * Hanya terima pesan yang dibuat SETELAH bot siap.
   * Ini mencegah replay chat lama (/update faqih-dina, YA, dll) saat npm start.
   */
  let acceptAfterSec = Math.floor(Date.now() / 1000) + 60;
  let isReady = false;
  let upsertBound = false;
  const seenIds = new Set();
  const msgCache = new Map();
  const GRACE_MS = 20_000;

  let sock;
  let hasLoggedQrHint = false;

  const markReady = () => {
    acceptAfterSec = Math.floor(Date.now() / 1000);
    isReady = true;
    logger.info('Bot siap menerima perintah (pesan lama diabaikan).');
  };

  const cacheMessage = (msg) => {
    const id = msg?.key?.id;
    if (!id || !msg?.message) return;
    msgCache.set(id, msg);
    if (msgCache.size > 500) {
      const first = msgCache.keys().next().value;
      msgCache.delete(first);
    }
  };

  const connect = async () => {
    sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
      },
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      syncFullHistory: false,
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: false,
      // WA minta retry isi pesan — tanpa cache, status sering "menunggu"
      getMessage: async (key) => {
        const id = key?.id;
        if (!id) return undefined;
        return msgCache.get(id)?.message;
      },
      shouldIgnoreJid: (jid) => jid === 'status@broadcast',
    });

    // Cache pesan keluar untuk retry/resend
    const originalSend = sock.sendMessage.bind(sock);
    sock.sendMessage = async (jid, content, options) => {
      const sent = await originalSend(jid, content, options);
      cacheMessage(sent);
      return sent;
    };

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        if (!hasLoggedQrHint) {
          logger.info('Scan QR WhatsApp berikut untuk login (session akan disimpan):');
          hasLoggedQrHint = true;
        }
        qrcode.generate(qr, { small: true });
      }

      if (connection === 'open') {
        isReady = false;
        acceptAfterSec = Math.floor((Date.now() + GRACE_MS) / 1000);
        logger.info('WhatsApp connected. Session tersimpan di sessions/wa');
        logger.info(
          `Mengabaikan buffer pesan lama selama ${GRACE_MS / 1000}s — jangan kirim perintah dulu...`,
        );
        setTimeout(markReady, GRACE_MS);
      }

      if (connection === 'close') {
        isReady = false;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        logger.warn(`WhatsApp disconnected (code=${statusCode}). reconnect=${shouldReconnect}`);

        if (shouldReconnect) {
          await connect();
        } else {
          logger.error('Session WhatsApp logout. Hapus sessions/wa lalu jalankan ulang untuk scan QR baru.');
        }
      }
    });

    // Bind upsert hanya sekali per socket instance (sock baru tiap connect)
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      // Abaikan history sync / append — hanya notify
      if (type !== 'notify') return;
      // Belum siap: buang semua (termasuk replay offline)
      if (!isReady) return;

      for (const msg of messages) {
        if (!msg.message || !msg.key) continue;
        if (msg.key.remoteJid === 'status@broadcast') continue;
        // Abaikan pesan sistem / revoke / protocol
        if (msg.messageStubType || msg.message.protocolMessage || msg.message.senderKeyDistributionMessage) {
          continue;
        }

        cacheMessage(msg);

        const mid = String(msg.key.id || '');
        if (mid) {
          if (seenIds.has(mid)) continue;
          seenIds.add(mid);
          if (seenIds.size > 3000) {
            const first = seenIds.values().next().value;
            seenIds.delete(first);
          }
        }

        // WAJIB: timestamp pesan harus SETELAH bot siap
        const ts = Number(msg.messageTimestamp || 0);
        if (!ts || ts < acceptAfterSec) {
          continue;
        }

        if (isMediaOnlyMessage(msg)) continue;

        if (msg.key.fromMe) {
          const text = getMessageText(msg);
          if (!isSelfCommand(text)) continue;
          if (looksLikeBotReply(text)) continue;
        } else {
          // Tandai sudah dibaca di HP bot (centang biru di HP pengirim)
          try {
            await sock.readMessages([msg.key]);
          } catch {
            // ignore
          }
        }

        try {
          await onMessage?.(sock, msg);
        } catch (err) {
          logger.error('Gagal handle pesan:', err?.message || err);
        }
      }
    });
  };

  await connect();

  return {
    get sock() {
      return sock;
    },
  };
}

function isMediaOnlyMessage(msg) {
  const m = msg?.message;
  if (!m) return true;
  if (
    m.imageMessage ||
    m.videoMessage ||
    m.documentMessage ||
    m.audioMessage ||
    m.stickerMessage ||
    m.ptvMessage ||
    m.viewOnceMessage ||
    m.viewOnceMessageV2 ||
    m.viewOnceMessageV2Extension
  ) {
    return true;
  }
  return false;
}

function looksLikeBotReply(text) {
  const t = String(text || '').trim();
  if (!t) return true;
  return (
    /^\*?(Ringkasan|Bot Undangan|Mode (UPDATE|BUAT)|Hallo kak)/im.test(t) ||
    /^- Hallo kak/im.test(t) ||
    /^(✅|❌|⏳|🔄|✏️|📩|💕|🔐)/u.test(t) ||
    /Ini hasil undangannya ya kak/i.test(t) ||
    /Mencari undangan|Mengganti akun|Memakai akun/i.test(t) ||
    /Generate link tamu:|Link tamu per nama:/i.test(t) ||
    /Update selesai \(internal\)|Buat undangan selesai \(internal\)/i.test(t)
  );
}

function isSelfCommand(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  if (looksLikeBotReply(t)) return false;
  if (t.startsWith('/')) return true;
  const lower = t.toLowerCase();
  if (
    ['ya', 'y', 'ok', 'oke', 'yes', 'batal', 'cancel', 'no', 'tidak', 'lanjut', 'proses', 'tukar'].includes(
      lower,
    )
  ) {
    return true;
  }
  if (t.length >= 80) {
    if (/\(\s*judul\s*\)/i.test(t)) return true;
    const hits = [
      /tema\s*:/i,
      /nama lengkap\s*:/i,
      /nama panggilan\s*:/i,
      /akad/i,
      /resepsi/i,
      /amplop digital|amplop online|nomer rekening|nomor rekening/i,
      /no\.?\s*rekening\s*:/i,
      /calon mempelai/i,
      /kelengkapan/i,
    ].filter((re) => re.test(t)).length;
    return hits >= 3;
  }
  return false;
}

export function getMessageText(msg) {
  const m = msg.message;
  if (!m) return '';
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    ''
  ).trim();
}

function extractDigits(jidOrPn) {
  return String(jidOrPn || '')
    .replace(/@.+$/, '')
    .split(':')[0]
    .replace(/\D/g, '');
}

function isLidJid(jid) {
  return String(jid || '').endsWith('@lid');
}

/**
 * Ambil nomor HP pengirim (bukan LID).
 * WA baru sering kirim remoteJid @lid — nomor asli ada di senderPn / participantPn.
 */
export function getSenderNumber(msg, sock) {
  if (msg?.key?.fromMe && sock?.user?.id) {
    return extractDigits(sock.user.id);
  }

  const key = msg?.key || {};
  const candidates = [key.participantPn, key.senderPn, key.participant, key.remoteJid];

  for (const c of candidates) {
    if (!c || isLidJid(c)) continue;
    const n = extractDigits(c);
    if (n.length >= 8) return n;
  }

  // Fallback terakhir (bisa LID — biasanya tidak cocok ADMIN_NUMBERS)
  return extractDigits(key.participant || key.remoteJid);
}

/** JID tujuan balasan — HARUS sama dengan chat masuk (jangan paksa @s.whatsapp.net).
 *  Kalau chat pakai @lid lalu dibalas ke @s.whatsapp.net, pesan sering "menunggu" selamanya.
 */
export function getReplyJid(msg) {
  return msg?.key?.remoteJid || '';
}

export function isAdminNumber(number) {
  const normalized = String(number || '').replace(/\D/g, '');
  if (!normalized) return false;

  // Samakan 08… → 62…
  const as62 = normalized.startsWith('0') ? `62${normalized.slice(1)}` : normalized;

  if (config.adminNumbers.includes(normalized) || config.adminNumbers.includes(as62)) {
    return true;
  }
  return config.adminNumbers.some(
    (admin) =>
      admin === as62 ||
      admin.endsWith(normalized) ||
      normalized.endsWith(admin) ||
      as62.endsWith(admin) ||
      admin.endsWith(as62),
  );
}
