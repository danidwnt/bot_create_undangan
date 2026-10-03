/**
 * Parser data undangan "gondongan" (format chat panjang).
 * Mendukung format admin lama + format kelengkapan customer.
 */

import {
  formatAddress,
  formatChildDescription,
  formatCoverDate,
  formatEventTime,
  formatParentsText,
  formatPersonName,
  parseDateToISO,
} from './format.js';
import { detectCoupleFormSwap } from './couple.js';

const MONTHS = {
  januari: 1,
  februari: 2,
  maret: 3,
  april: 4,
  mei: 5,
  juni: 6,
  juli: 7,
  agustus: 8,
  september: 9,
  oktober: 10,
  november: 11,
  desember: 12,
};

export function looksLikeGondongan(text) {
  const t = String(text || '').toLowerCase();
  if (t.length < 80) return false;
  const hits = [
    /tema\s*:/,
    /nama lengkap\s*:/,
    /akad/,
    /resepsi/,
    /amplop digital|amplop online|nomer rekening|nomor rekening/,
    /no rekening\s*:|bank\s+\w+/,
    /google maps/,
    /nama panggilan\s*:/,
    /calon mempelai/,
    /kelengkapan/,
  ].filter((re) => re.test(t)).length;
  return hits >= 3;
}

export function parseGondongan(rawText) {
  const text = normalizeText(rawText);
  const errors = [];

  const themeName = pick(text, [
    /tema\s*:\s*(.+)$/im,
    /tema undangan\s*:\s*(.+)$/im,
  ]);
  const religion = pick(text, [
    /agama undangan\s*:\s*(.+)$/im,
    /agama\s*:\s*(.+)$/im,
  ]);

  // Musik / YouTube — format lama + kelengkapan customer
  const musicOrYt = pick(text, [
    /judul lagu\s*:\s*(.+)$/im,
    /kirim nama lagu\/?link lagu[^\n]*:\s*(.+)$/im,
    /nama lagu\/?link lagu[^\n]*:\s*(.+)$/im,
    /nama lagu[^\n]*:\s*(.+)$/im,
    /lagu\s*:\s*(.+)$/im,
  ]);
  let musicTitle = '';
  let youtube = pick(text, [
    /link youtube\s*:\s*(https?:\/\/\S+)/im,
    /youtube\s*:\s*(https?:\/\/\S+)/im,
  ]);
  if (musicOrYt) {
    const ytInField = musicOrYt.match(/https?:\/\/\S+/i)?.[0] || '';
    if (ytInField) {
      youtube = youtube || ytInField;
      const rest = musicOrYt.replace(ytInField, '').replace(/[?&]si=\S+/i, '').trim();
      musicTitle = rest && !/^https?:\/\//i.test(rest) ? rest : '';
    } else {
      musicTitle = musicOrYt;
    }
  }

  const nameOrderRaw = pick(text, [
    /urutan nama[^\n]*:\s*(.+)$/im,
    /yang ditulis duluan[^\n]*:\s*(.+)$/im,
    /ditulis duluan[^\n]*:\s*(.+)$/im,
  ]);

  const swapCoupleForms = detectCoupleFormSwap(text);

  const useEnvelope =
    /pakai amplop digital\s*:\s*ya/i.test(text) ||
    /amplop online/i.test(text) ||
    /nomer rekening|nomor rekening/i.test(text);

  const brideBlock =
    extractPersonBlock(text, 'wanita') ||
    extractPersonBlock(text, 'mempelai wanita') ||
    extractPersonBlock(text, 'cewe');
  const groomBlock =
    extractPersonBlock(text, 'pria') ||
    extractPersonBlock(text, 'mempelai pria') ||
    extractPersonBlock(text, 'cowo');

  const bride = parsePerson(brideBlock, 'wanita');
  const groom = parsePerson(groomBlock, 'pria');

  if (!bride.fullName) errors.push('Nama lengkap wanita belum terdeteksi');
  if (!groom.fullName) errors.push('Nama lengkap pria belum terdeteksi');

  let nameOrder = resolveNameOrder(nameOrderRaw, bride, groom);

  const events = [];
  const akad = parseEvent(extractEventBlock(text, 'akad'), 'Akad Nikah');
  const resepsi = parseEvent(extractEventBlock(text, 'resepsi'), 'Resepsi');
  const ngunduh = parseEvent(extractEventBlock(text, 'ngunduh'), 'Ngunduh Mantu');

  if (akad && hasEventContent(akad)) events.push(akad);
  if (resepsi && hasEventContent(resepsi)) events.push(resepsi);
  if (ngunduh && hasEventContent(ngunduh)) events.push(ngunduh);
  if (!events.length) errors.push('Data acara (Akad/Resepsi) belum terdeteksi');

  const accounts =
    useEnvelope || /amplop digital|amplop online|no rekening|bank\s+/i.test(text)
      ? parseAccounts(text)
      : [];

  const brideNick = bride.nickname || firstName(bride.fullName);
  const groomNick = groom.nickname || firstName(groom.fullName);
  const brideTitle = shortName(brideNick, bride.fullName);
  const groomTitle = shortName(groomNick, groom.fullName);

  const title =
    nameOrder === 'pria_dulu' ? `${groomTitle} & ${brideTitle}` : `${brideTitle} & ${groomTitle}`;

  const slug = slugify(
    nameOrder === 'pria_dulu'
      ? `${groomTitle}-${brideTitle}`
      : `${brideTitle}-${groomTitle}`,
  );

  const resepsiEvent =
    events.find((e) => /resepsi/i.test(e.name || '')) || events[0] || {};
  const coverDateText =
    formatCoverDate(resepsiEvent.dateISO || resepsiEvent.dateText) || '';
  const coverDateTime = resepsiEvent.dateISO
    ? `${resepsiEvent.dateISO}T${guessStartTime(resepsiEvent.time) || '08:00'}`
    : '';
  const coverDateTimeNorm = coverDateTime.replace(
    /^(\d{4}-\d{2}-\d{2})[T\s](\d{1,2}):(\d{2}).*$/,
    (_, d, h, min) => `${d}T${String(h).padStart(2, '0')}:${min}`,
  );

  const data = {
    themeName: cleanValue(themeName) || '',
    templateId: '',
    categoryId: '156',
    taxonomy: 'template-pernikahan',
    religion: cleanValue(religion) || '',
    nameOrder,
    swapCoupleForms,
    title,
    slug,
    coverDateText,
    coverDateTime: coverDateTimeNorm || coverDateTime,
    youtube: cleanValue(youtube) || '',
    musicTitle: cleanValue(musicTitle) || '',
    musicUrl: '',
    useDigitalEnvelope: useEnvelope || accounts.length > 0,
    bride,
    groom,
    events,
    accounts,
    notes: {
      photos: /foto/i.test(text) ? 'Foto dikirim manual via WhatsApp' : '',
      source: 'gondongan',
    },
  };

  return { data, errors, warnings: buildWarnings(data) };
}

export function formatGondonganSummary(data, extras = {}) {
  const lines = [
    '*Ringkasan data gondongan*',
    `Tema: ${data.themeName || '-'}`,
    extras.templateId ? `Template ID: ${extras.templateId}` : null,
    `Judul: ${data.title}`,
    data.title ? `Meta: The Wedding Of ${data.title}` : null,
    `Slug: ${data.slug}`,
    `Cover: ${data.coverDateText || '-'}`,
    `Agama: ${data.religion || '-'}`,
    extras.religionNote ? `Teks doa: ${extras.religionNote}` : null,
    `Urutan: ${data.nameOrder === 'pria_dulu' ? 'Pria dulu' : 'Wanita dulu'}`,
    data.swapCoupleForms
      ? 'Form mempelai: *DITUKAR* (template posisi terbalik)'
      : 'Form mempelai: normal',
    `Musik: ${data.musicTitle || '-'}`,
    `YouTube: ${data.youtube || '-'} (manual, tidak diisi otomatis)`,
    '',
    `Wanita: ${data.bride?.fullName || '-'} (${data.bride?.nickname || '-'})`,
    `Pria: ${data.groom?.fullName || '-'} (${data.groom?.nickname || '-'})`,
    '',
    '*Acara*',
    ...(data.events || []).map(
      (e, i) =>
        `${i + 1}. ${e.name}: ${e.dateText || e.dateISO || '-'} | ${e.time || '-'} | ${e.place || '-'}`,
    ),
    '',
    `*Amplop digital (${(data.accounts || []).length})*`,
    ...(data.accounts || []).map(
      (a, i) => `${i + 1}. ${a.owner || '-'} | ${a.bank || '-'} | ${a.number || '-'}`,
    ),
  ].filter((x) => x != null);

  return lines.join('\n');
}

function buildWarnings(data) {
  const warnings = [];
  if (!data.themeName) warnings.push('Tema belum terdeteksi');
  if (!data.religion) warnings.push('Agama belum terdeteksi');
  if (!data.musicTitle) warnings.push('Judul lagu belum terdeteksi (YouTube tetap manual)');
  if (!data.accounts?.length) warnings.push('Rekening/amplop belum terdeteksi');
  return warnings;
}

function resolveNameOrder(nameOrderRaw, bride, groom) {
  const raw = cleanValue(nameOrderRaw);
  if (!raw) return 'wanita_dulu';

  if (/^(cowo|pria|laki)/i.test(raw) || /pria\s*(lebih\s*)?dulu/i.test(raw)) {
    return 'pria_dulu';
  }
  if (/^(cewe|wanita|perempuan)/i.test(raw) || /wanita\s*(lebih\s*)?dulu/i.test(raw)) {
    return 'wanita_dulu';
  }

  // Nilai berupa nama orang: cocokkan ke mempelai
  const hint = raw.toLowerCase().replace(/[^a-z0-9\s']/g, ' ').replace(/\s+/g, ' ').trim();
  const brideKey = String(bride?.fullName || bride?.nickname || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const groomKey = String(groom?.fullName || groom?.nickname || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (groomKey && (hint.includes(groomKey) || groomKey.includes(hint))) return 'pria_dulu';
  if (brideKey && (hint.includes(brideKey) || brideKey.includes(hint))) return 'wanita_dulu';

  return 'wanita_dulu';
}

function normalizeText(raw) {
  return String(raw || '')
    .replace(/\r/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[•●◦▪︎]/g, '-')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

function pick(text, patterns) {
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return '';
}

function cleanValue(value) {
  return String(value || '')
    .replace(/^[-*>]\s*/, '')
    .replace(/\s+/g, ' ')
    .replace(/\*+/g, '')
    .trim();
}

function extractPersonBlock(text, label) {
  const lab = String(label || '').toLowerCase();
  const patterns = [
    // (1) Wanita / (2) Pria
    new RegExp(
      `\\(\\d+\\)?\\s*${lab}[\\s\\S]*?(?=\\(\\d+\\)\\s*(?:wanita|pria|akad|resepsi|ngunduh)|\\d+\\.\\s*calon|\\d+\\.\\s*akad|\\d+\\.\\s*resepsi|$)`,
      'i',
    ),
    // 1. CALON MEMPELAI WANITA
    new RegExp(
      `\\d+\\.\\s*calon\\s+mempelai\\s+${lab}[\\s\\S]*?(?=\\d+\\.\\s*calon|\\d+\\.\\s*akad|\\d+\\.\\s*resepsi|\\d+\\.\\s*ngunduh|catatan\\s*:|$)`,
      'i',
    ),
    // CALON MEMPELAI WANITA (tanpa nomor)
    new RegExp(
      `calon\\s+mempelai\\s+${lab}[\\s\\S]*?(?=calon\\s+mempelai|\\d+\\.\\s*akad|akad\\s*nikah|\\d+\\.\\s*resepsi|resepsi|catatan\\s*:|$)`,
      'i',
    ),
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[0]) return m[0];
  }
  return '';
}

function extractEventBlock(text, label) {
  const lab = String(label || '').toLowerCase();
  const patterns = [
    new RegExp(
      `\\(\\d+\\)?\\s*${lab}[\\s\\S]*?(?=\\(\\d+\\)\\s*(?:wanita|pria|akad|resepsi|ngunduh)|\\d+\\.\\s*(?:calon|akad|resepsi|ngunduh)|catatan\\s*:|$)`,
      'i',
    ),
    // 3. AKAD NIKAH / 4. RESEPSI
    new RegExp(
      `\\d+\\.\\s*${lab}(?:\\s*nikah)?[\\s\\S]*?(?=\\d+\\.\\s*(?:calon|akad|resepsi|ngunduh)|catatan\\s*:|$)`,
      'i',
    ),
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[0]) return m[0];
  }
  return '';
}

function parsePerson(block, role) {
  const fullName = pick(block, [
    /nama lengkap\s*:\s*(.+)$/im,
    /nama\s*:\s*(.+)$/im,
  ]);
  const nickname = pick(block, [/nama panggilan\s*:\s*(.+)$/im]);
  const childOrder = pick(block, [
    /putri ke\s*:\s*(.+)$/im,
    /putra ke\s*:\s*(.+)$/im,
    /putri\s*:\s*(.+)$/im,
    /putra\s*:\s*(.+)$/im,
    /anak ke\s*:\s*(.+)$/im,
  ]);
  const parents = pick(block, [
    /nama orang tua\s*:\s*(.+)$/im,
    /nama ortu\s*:\s*(.+)$/im,
    /orang tua\s*:\s*(.+)$/im,
    /ortu\s*:\s*(.+)$/im,
  ]);

  const description = formatChildDescription(role, childOrder);
  const orderNum = Number(String(childOrder || '').replace(/\D/g, '')) || 1;

  return {
    fullName: formatPersonName(fullName),
    nickname: formatPersonName(nickname) || firstName(formatPersonName(fullName)),
    childOrder: orderNum,
    description,
    parents: formatParentsText(parents),
  };
}

function parseEvent(block, defaultName) {
  if (!block) return null;
  const dateText = pick(block, [
    /hari\s*[,&\/]?\s*tanggal\s*:\s*(.+)$/im,
    /hari\s*&\s*tanggal\s*:\s*(.+)$/im,
    /tanggal\s*:\s*(.+)$/im,
  ]);
  const time = pick(block, [/jam\s*:\s*(.+)$/im]);
  const place = pick(block, [/tempat\s*:\s*(.+)$/im]);
  const address = pick(block, [/alamat\s*:\s*(.+)$/im]);
  const maps = pick(block, [
    /tautan.*google maps\s*:\s*(https?:\/\/\S+)/im,
    /link\s*google maps\s*:\s*(https?:\/\/\S+)/im,
    /google maps\s*:\s*(https?:\/\/\S+)/im,
    /maps\s*:\s*(https?:\/\/\S+)/im,
  ]);

  const cleanedDate = cleanValue(dateText);
  const cleanedTime = cleanValue(time);
  if (
    isBlankDash(cleanedDate) &&
    isBlankDash(cleanedTime) &&
    isBlankDash(place) &&
    isBlankDash(address)
  ) {
    return null;
  }

  const dateISO = parseDateToISO(cleanedDate) || toISODate(cleanedDate);
  const niceDate = formatCoverDate(dateISO || cleanedDate);

  return {
    name: defaultName,
    dateText: niceDate || (isBlankDash(cleanedDate) ? '' : cleanedDate),
    dateISO,
    time: isBlankDash(cleanedTime) ? '' : formatEventTime(cleanedTime),
    place: isBlankDash(cleanValue(place)) ? '' : formatAddress(cleanValue(place)),
    address: isBlankDash(cleanValue(address)) ? '' : formatAddress(cleanValue(address)),
    maps: isBlankDash(cleanValue(maps)) ? '' : cleanValue(maps),
  };
}

function hasEventContent(event) {
  return Boolean(
    event?.dateISO || event?.dateText || event?.place || event?.address || event?.time,
  );
}

function parseAccounts(text) {
  // Format kelengkapan: "> NAMA / Bank Xxx / nomor"
  const customer = parseCustomerAccounts(text);
  if (customer.length) return customer;

  const accounts = [];

  const sectionMatch =
    text.match(
      /amplop digital\s*\([^)]*\)\s*:([\s\S]*?)(?=urutan nama|yang ditulis|\(1\)\s*wanita|\d+\.\s*calon|catatan\s*:|$)/i,
    ) ||
    text.match(
      /pakai amplop digital\s*:\s*ya([\s\S]*?)(?=urutan nama|yang ditulis|\(1\)\s*wanita|\d+\.\s*calon|catatan\s*:|$)/i,
    );

  const amplopSection = sectionMatch?.[1] || sectionMatch?.[0] || '';
  const sourceText = amplopSection || text;
  const chunks = sourceText.split(/\(\s*\d+\s*\)/g).slice(1);
  const blocks = chunks.length ? chunks : [sourceText];

  for (const chunk of blocks) {
    const owner = pick(chunk, [
      /nama pemilik\s*:\s*(.+)$/im,
      /atas nama\s*:\s*(.+)$/im,
    ]);
    const number = pick(chunk, [
      /no\.?\s*rekening\s*:\s*(.+)$/im,
      /nomor rekening\s*:\s*(.+)$/im,
      /rekening\s*:\s*(.+)$/im,
    ]);
    const bank = pick(chunk, [
      /bank\s*\/\s*e-?wallet\s*:\s*(.+)$/im,
      /bank\s*:\s*(.+)$/im,
      /e-?wallet\s*:\s*(.+)$/im,
    ]);
    if (!owner && !number) continue;
    accounts.push({
      owner: formatPersonName(owner),
      number: cleanValue(number).replace(/\s+/g, ''),
      bank: normalizeBankName(cleanValue(bank)),
    });
  }

  if (!accounts.length) {
    const re =
      /nama pemilik\s*:\s*(.+)\n(?:.*\n)?.*?no\.?\s*rekening\s*:\s*(.+)\n(?:.*\n)?.*?bank\s*\/?\s*e-?wallet\s*:\s*(.+)/gi;
    let m;
    while ((m = re.exec(text)) && accounts.length < 3) {
      accounts.push({
        owner: formatPersonName(m[1]),
        number: cleanValue(m[2]).replace(/\s+/g, ''),
        bank: normalizeBankName(cleanValue(m[3])),
      });
    }
  }

  return accounts.filter((a) => a.owner || a.number).slice(0, 3);
}

/** Format: > NAMA / - Bank Xxx / - 123456 */
function parseCustomerAccounts(text) {
  const section =
    text.match(
      /(?:amplop online|nomer rekening|nomor rekening)[^\n]*:([\s\S]*?)(?=yang ditulis duluan|\d+\.\s*calon|calon mempelai|catatan\s*:|$)/i,
    )?.[1] || '';

  if (!section.trim()) return [];

  const chunks = section
    .split(/>\s*/)
    .map((s) => s.trim())
    .filter(Boolean);

  const accounts = [];
  for (const chunk of chunks) {
    const lines = chunk
      .split(/\n+/)
      .map((l) =>
        String(l || '')
          .replace(/^[\s\-*>•●◦▪·∙]+/, '')
          .replace(/\s+/g, ' ')
          .replace(/\*+/g, '')
          .trim(),
      )
      .filter(Boolean);
    if (!lines.length) continue;

    let owner = '';
    let bank = '';
    let number = '';

    for (const line of lines) {
      const bankMatch = line.match(/\bbank\s*[:.]?\s*(.+)$/i);
      if (bankMatch) {
        bank = bankMatch[1].trim();
        continue;
      }
      const digits = line.replace(/[^\d]/g, '');
      if (digits.length >= 8 && digits.length <= 20) {
        number = digits;
        continue;
      }
      if (!owner) {
        owner = line;
      }
    }

    if (owner || number) {
      accounts.push({
        owner: formatPersonName(owner),
        number,
        bank: normalizeBankName(bank),
      });
    }
  }

  return accounts.slice(0, 3);
}

function normalizeBankName(name) {
  const n = String(name || '').toLowerCase();
  if (n.includes('dana')) return 'Dana';
  if (n.includes('bri')) return 'BRI';
  if (n.includes('bca')) return 'BCA';
  if (n.includes('mandiri')) return 'Mandiri';
  if (n.includes('bni')) return 'BNI';
  if (n.includes('gopay')) return 'Gopay';
  if (n.includes('ovo')) return 'Ovo';
  if (n.includes('shopee')) return 'ShopeePay';
  return cleanValue(name);
}

function toISODate(dateText) {
  const t = String(dateText || '').toLowerCase().trim();
  if (!t || t === '-') return '';

  const m1 = t.match(/(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/);
  if (m1) {
    const day = Number(m1[1]);
    const month = MONTHS[m1[2].toLowerCase()] || 0;
    const year = Number(m1[3]);
    if (month) return `${year}-${pad(month)}-${pad(day)}`;
  }

  const m2 = t.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m2) {
    return `${m2[3]}-${pad(m2[2])}-${pad(m2[1])}`;
  }

  return '';
}

function guessStartTime(timeText) {
  const m = String(timeText || '').match(/(\d{1,2})[.:](\d{2})/);
  if (!m) return '';
  return `${pad(m[1])}:${m[2]}`;
}

function isBlankDash(value) {
  const v = String(value || '').trim();
  return !v || v === '-' || v.toLowerCase() === 'n/a';
}

function firstName(fullName) {
  const parts = String(fullName || '')
    .replace(/,.*/, '')
    .trim()
    .split(/\s+/);
  return parts[0] || 'Mempelai';
}

function shortName(nickname, fullName) {
  const nick = cleanValue(nickname);
  const fromFull = firstName(fullName);
  if (!nick) return fromFull;
  if (nick.length <= 12) return nick;
  return fromFull;
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 60);
}

function pad(n) {
  return String(n).padStart(2, '0');
}
