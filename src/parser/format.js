/**
 * Normalisasi format jam & nama untuk undangan.
 */

/** Gelar akademik / kehormatan umum (huruf kecil tanpa titik) -> bentuk standar */
const TITLE_MAP = {
  's ag': 'S.Ag.',
  sag: 'S.Ag.',
  's agi': 'S.Ag.',
  's kom': 'S.Kom.',
  skom: 'S.Kom.',
  's sos': 'S.Sos.',
  ssos: 'S.Sos.',
  's pd': 'S.Pd.',
  spd: 'S.Pd.',
  's psi': 'S.Psi.',
  spsi: 'S.Psi.',
  's kep': 'S.Kep.',
  skep: 'S.Kep.',
  's keb': 'S.Keb.',
  skeb: 'S.Keb.',
  's farm': 'S.Farm.',
  sfarm: 'S.Farm.',
  's h': 'S.H.',
  sh: 'S.H.',
  's e': 'S.E.',
  se: 'S.E.',
  's t': 'S.T.',
  st: 'S.T.',
  's si': 'S.Si.',
  ssi: 'S.Si.',
  's ip': 'S.IP.',
  sip: 'S.IP.',
  's ikom': 'S.I.Kom.',
  sikom: 'S.I.Kom.',
  's ab': 'S.Ab.',
  sab: 'S.Ab.',
  's ap': 'S.AP.',
  sap: 'S.AP.',
  's gz': 'S.Gz.',
  sgz: 'S.Gz.',
  's hut': 'S.Hut.',
  shut: 'S.Hut.',
  's pt': 'S.Pt.',
  spt: 'S.Pt.',
  's tp': 'S.TP.',
  stp: 'S.TP.',
  'a md': 'A.Md.',
  amd: 'A.Md.',
  'a md kep': 'A.Md.Kep.',
  'm kom': 'M.Kom.',
  mkom: 'M.Kom.',
  'm pd': 'M.Pd.',
  mpd: 'M.Pd.',
  'm si': 'M.Si.',
  msi: 'M.Si.',
  'm m': 'M.M.',
  mm: 'M.M.',
  'm kes': 'M.Kes.',
  mkes: 'M.Kes.',
  'm hum': 'M.Hum.',
  mhum: 'M.Hum.',
  'm sc': 'M.Sc.',
  msc: 'M.Sc.',
  mba: 'MBA',
  phd: 'Ph.D.',
  'ph d': 'Ph.D.',
  dr: 'Dr.',
  dra: 'Dra.',
  drs: 'Drs.',
  ir: 'Ir.',
  prof: 'Prof.',
  h: 'H.',
  hj: 'Hj.',
  kh: 'KH.',
  ust: 'Ust.',
  ustad: 'Ust.',
  ustadz: 'Ust.',
  ustadzah: 'Ustadzah',
  bpk: 'Bpk.',
  bapak: 'Bapak',
  ibu: 'Ibu',
  ibuk: 'Ibu',
  alm: 'Alm.',
  almh: 'Almh.',
  almarhum: 'Alm.',
  almarhumah: 'Almh.',
  rm: 'Rm.',
};

/**
 * Format jam undangan.
 * Contoh hasil:
 * - 08.00 WIB - Selesai
 * - 08.00 - 10.00 WIB
 */
export function formatEventTime(raw) {
  let t = String(raw || '')
    .trim()
    .replace(/selsai|selesa(?!i)/gi, 'selesai')
    .replace(/s\/d|sd\b/gi, 'sampai')
    .replace(/sampai dengan/gi, 'sampai')
    .replace(/pukul\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!t || t === '-') return '';

  const times = [...t.matchAll(/(\d{1,2})[.:](\d{2})/g)].map(
    (m) => `${String(m[1]).padStart(2, '0')}.${m[2]}`,
  );

  const untilDone = /selesai|dst|dst\.|finish/i.test(t);

  if (times.length >= 2) {
    return `${times[0]} - ${times[1]} WIB`;
  }

  if (times.length === 1) {
    if (untilDone || /sampai/i.test(t)) {
      return `${times[0]} WIB - Selesai`;
    }
    return `${times[0]} WIB`;
  }

  // fallback: minimal rapikan
  return t.replace(/\bwib\b/gi, 'WIB').replace(/\bselesai\b/gi, 'Selesai');
}

/**
 * Kapitalisasi nama + rapikan gelar.
 * Contoh: "aldi saputra, s. ag" -> "Aldi Saputra, S.Ag."
 */
export function formatPersonName(raw) {
  const value = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!value || value === '-') return '';

  // Split name vs titles after comma
  const parts = value.split(',').map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return '';

  const namePart = formatNameWords(parts[0]);
  const titles = parts
    .slice(1)
    .flatMap((chunk) => splitTitles(chunk))
    .map(normalizeTitle)
    .filter(Boolean);

  if (!titles.length) return namePart;
  return `${namePart}, ${titles.join(', ')}`;
}

/**
 * Untuk teks orang tua yang mengandung "dan", "Alm.", dll.
 * Otomatis menambah Bpk. (orang tua 1) & Ibu (orang tua 2) jika belum ada.
 * Contoh:
 * - "(ALM) pairis nedi & Titin Sumantri." → "(Alm.) Bpk. Pairis Nedi & Ibu Titin Sumantri"
 * - "Mu'aridin &Aryanti" → "Bpk. Mu'aridin & Ibu Aryanti"
 */
export function formatParentsText(raw) {
  let value = String(raw || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!value || value === '-') return '';

  // Rapikan & / dan yang nempel: "&Aryanti" / "A&B"
  value = value
    .replace(/\s*&\s*/g, ' & ')
    .replace(/\s+dan\s+/gi, ' dan ');

  // Normalisasi Alm/Almh di depan atau dalam kurung
  value = value
    .replace(/\(\s*almh\.?\s*\)/gi, '(Almh.)')
    .replace(/\(\s*alm\.?\s*\)/gi, '(Alm.)')
    .replace(/\balmh\.?(?=\s|$)/gi, 'Almh.')
    .replace(/\balm\.?(?=\s|$)/gi, 'Alm.')
    .replace(/\(\s*r\.?\s*m\.?\s+/gi, '(Rm. ')
    .replace(/\bibuk\.?(?=\s|$|,)/gi, 'Ibu')
    .replace(/\bbapak\.?(?=\s|$|,)/gi, 'Bpk.')
    .replace(/\bbpk\.?(?=\s|$|,)/gi, 'Bpk.')
    // Buang titik akhir yang bukan gelar (Sumantri.)
    .replace(/\.(?=\s*$)/, '');

  const parts = value.split(/(\s+dan\s+|\s+&\s+)/i);
  const personIndexes = [];
  for (let i = 0; i < parts.length; i += 1) {
    if (!/^\s*(dan|&)\s*$/i.test(parts[i])) personIndexes.push(i);
  }

  return parts
    .map((chunk, idx) => {
      if (/^\s*dan\s*$/i.test(chunk)) return ' dan ';
      if (/^\s*&\s*$/i.test(chunk)) return ' & ';
      const personOrder = personIndexes.indexOf(idx);
      // Orang tua 1 → Bpk., orang tua 2 → Ibu (jika belum ada sapaan)
      const role = personOrder === 0 ? 'bpk' : personOrder === 1 ? 'ibu' : '';
      return ensureParentHonorific(formatParentChunk(chunk), role);
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

function ensureParentHonorific(formatted, role) {
  const text = String(formatted || '').trim();
  if (!text || !role) return text;
  // Jangan pakai \b setelah "Bpk." — titik bukan word char
  if (/(?:^|[\s(])(?:Bpk\.?|Ibu|Bapak|Ayah|Mama|Mamah|Umi|Abi|Abah)\b/i.test(text)) {
    return text;
  }
  const honor = role === 'ibu' ? 'Ibu' : 'Bpk.';
  // Sisipkan setelah (Alm.)/(Almh.) di depan
  if (/^\(Almh?\.\)\s+/i.test(text)) {
    return text.replace(/^(\(Almh?\.\))\s+/i, `$1 ${honor} `);
  }
  return `${honor} ${text}`;
}

function formatParentChunk(chunk) {
  let text = String(chunk || '').trim();
  if (!text) return '';

  // Prefix Alm./Almh. di depan nama (dengan/ tanpa kurung)
  let prefix = '';
  const prefixMatch = text.match(/^(?:\(\s*)?(Almh?\.?)(?:\s*\))?\s+/i);
  if (prefixMatch) {
    const raw = prefixMatch[1];
    prefix = /almh/i.test(raw) ? '(Almh.) ' : '(Alm.) ';
    text = text.slice(prefixMatch[0].length).trim();
  }

  // Catatan kurung di akhir: (Alm.) / (Rm. ...)
  const m = text.match(/^(.*?)(\([^)]*\))\s*$/);
  const mainRaw = (m?.[1] || text).trim();
  let note = m?.[2] || '';
  if (note) {
    note = note
      .replace(/\(\s*almh\.?\s*\)/i, '(Almh.)')
      .replace(/\(\s*alm\.?\s*\)/i, '(Alm.)')
      .replace(/\(\s*r\.?\s*m\.?\s*([^)]*)\)/i, (_, rest) => `(Rm. ${formatPersonName(rest)})`);
  }

  const main = formatPersonName(mainRaw);
  // Pertahankan posisi: Alm di depan → prefix; Alm di belakang → note
  return `${prefix}${main}${note ? ` ${note}` : ''}`.trim();
}

function formatNameWords(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      // Honorific attached without comma: Bpk./Ibu./Alm.
      const titled = normalizeTitle(word);
      if (titled !== word && /\./.test(titled)) return titled;
      if (/^[A-Z]\.?$/i.test(word)) return word.toUpperCase().replace(/\.$/, '') + '.';
      return capitalizeWord(word);
    })
    .join(' ');
}

function splitTitles(chunk) {
  // "S. Ag M.Kom" / "S.Ag., M.Kom."
  return String(chunk || '')
    .split(/[,;/|]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeTitle(raw) {
  const original = String(raw || '').trim();
  if (!original) return '';

  const key = original
    .toLowerCase()
    .replace(/\./g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (TITLE_MAP[key]) return TITLE_MAP[key];

  // Compact key without spaces: "s ag" already handled; try "sag"
  const compact = key.replace(/\s+/g, '');
  if (TITLE_MAP[compact]) return TITLE_MAP[compact];

  // Pattern S.Xxx / M.Xxx / A.Md
  const academic = original.match(/^([a-z]{1,4})[.\s]+([a-z]{1,8})(?:[.\s]+([a-z]{1,8}))?\.?$/i);
  if (academic) {
    const a = academic[1].toUpperCase();
    const b = capitalizeTitleSegment(academic[2]);
    const c = academic[3] ? capitalizeTitleSegment(academic[3]) : '';
    return c ? `${a}.${b}.${c}.` : `${a}.${b}.`;
  }

  // Default: Title Case ordinary word, keep known short honorifics
  if (/^(bpk|ibu|ibuk|alm|almh|rm)\.?$/i.test(original)) {
    return TITLE_MAP[original.toLowerCase().replace(/\./g, '')] || capitalizeWord(original);
  }

  return capitalizeWord(original);
}

function capitalizeTitleSegment(seg) {
  const s = String(seg || '');
  if (s.length <= 3) return s.toUpperCase();
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/**
 * Format deskripsi urutan anak.
 * Contoh:
 * - Putra Pertama Dari
 * - Putri Kedua Dari
 * - Putra Tunggal Dari
 * - Putri Bungsu Dari
 */
export function formatChildDescription(role, rawOrder) {
  const kind = role === 'wanita' || role === 'putri' ? 'Putri' : 'Putra';
  const orderLabel = normalizeChildOrderLabel(rawOrder);
  return `${kind} ${orderLabel} Dari`;
}

function normalizeChildOrderLabel(raw) {
  const value = String(raw || '')
    .toLowerCase()
    .replace(/putr[ai]\s*/gi, '')
    .replace(/ke-?/gi, '')
    .replace(/dari/gi, '')
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!value) return 'Pertama';

  // Text aliases
  if (/(tunggal|only)/i.test(value)) return 'Tunggal';
  if (/(bungsu|terakhir|last)/i.test(value)) return 'Bungsu';
  if (/(sulung|tertua|oldest)/i.test(value)) return 'Pertama';

  const wordMap = {
    satu: 1,
    pertama: 1,
    kedua: 2,
    dua: 2,
    ketiga: 3,
    tiga: 3,
    keempat: 4,
    empat: 4,
    kelima: 5,
    lima: 5,
    keenam: 6,
    enam: 6,
    ketujuh: 7,
    tujuh: 7,
    kedelapan: 8,
    delapan: 8,
    kesembilan: 9,
    sembilan: 9,
    kesepuluh: 10,
    sepuluh: 10,
  };

  for (const [word, num] of Object.entries(wordMap)) {
    if (value === word || value.includes(word)) {
      return numberToOrderLabel(num);
    }
  }

  const num = Number(String(value).replace(/\D/g, ''));
  if (Number.isFinite(num) && num > 0) {
    return numberToOrderLabel(num);
  }

  // Already a nice word like "Pertama"
  return value
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function numberToOrderLabel(n) {
  const map = {
    1: 'Pertama',
    2: 'Kedua',
    3: 'Ketiga',
    4: 'Keempat',
    5: 'Kelima',
    6: 'Keenam',
    7: 'Ketujuh',
    8: 'Kedelapan',
    9: 'Kesembilan',
    10: 'Kesepuluh',
  };
  return map[n] || `Ke-${n}`;
}

/**
 * Format Tanggal Acara Cover.
 * Selalu: "Sabtu, 24 Oktober 2026"
 * Menerima input berantakan: "Sabtu & 24, oktober,2026", "24 okt 2026", dll.
 */
export function formatCoverDate(isoOrText) {
  const iso = toISODateLoose(isoOrText);
  if (!iso) return '';

  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return '';

  const weekday = WEEKDAYS_ID[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  const monthName = MONTHS_ID[month - 1];
  if (!weekday || !monthName) return '';

  return `${weekday}, ${day} ${monthName} ${year}`;
}

/** Parse teks tanggal Indonesia → ISO YYYY-MM-DD */
export function parseDateToISO(value) {
  return toISODateLoose(value);
}

const WEEKDAYS_ID = [
  'Minggu',
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
];

const MONTHS_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const MONTHS_PARSE = {
  januari: 1,
  jan: 1,
  februari: 2,
  feb: 2,
  maret: 3,
  mar: 3,
  april: 4,
  apr: 4,
  mei: 5,
  juni: 6,
  jun: 6,
  juli: 7,
  jul: 7,
  agustus: 8,
  agu: 8,
  ags: 8,
  september: 9,
  sep: 9,
  oktober: 10,
  okt: 10,
  november: 11,
  nov: 11,
  desember: 12,
  des: 12,
};

function toISODateLoose(value) {
  let raw = String(value || '')
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .trim();
  if (!raw || raw === '-') return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  // 24/10/2026 or 24-10-2026 (sebelum normalisasi spasi)
  let m = raw.match(/(\d{1,2})\s*[\/\-]\s*(\d{1,2})\s*[\/\-]\s*(\d{4})/);
  if (m) {
    return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(Number(m[1])).padStart(2, '0')}`;
  }

  // Rapikan: "Sabtu & 24, oktober,2026" → "sabtu 24 oktober 2026"
  let lower = raw
    .toLowerCase()
    .replace(/[＆&]+/g, ' ')
    .replace(/\bdan\b/g, ' ')
    .replace(/[.,;/|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Buang nama hari di depan (bisa berulang)
  lower = lower
    .replace(
      /^(minggu|senin|selasa|rabu|kamis|jumat|jum'?at|sabtu)(\s+|$)/i,
      '',
    )
    .trim();

  // 24 oktober 2026 / 24 okt2026
  m = lower.match(/(\d{1,2})\s*([a-z]+)\s*(\d{4})/);
  if (m) {
    const month = MONTHS_PARSE[m[2]] || 0;
    if (month) {
      return `${m[3]}-${String(month).padStart(2, '0')}-${String(Number(m[1])).padStart(2, '0')}`;
    }
  }

  // Ambisius: cari pola day+month+year di mana saja dalam string
  m = lower.match(/(\d{1,2})\D{0,5}(januari|jan|februari|feb|maret|mar|april|apr|mei|juni|jun|juli|jul|agustus|agu|ags|september|sep|oktober|okt|november|nov|desember|des)\D{0,5}(\d{4})/);
  if (m) {
    const month = MONTHS_PARSE[m[2]] || 0;
    if (month) {
      return `${m[3]}-${String(month).padStart(2, '0')}-${String(Number(m[1])).padStart(2, '0')}`;
    }
  }

  // oktober 24 2026 (bulan dulu)
  m = lower.match(/([a-z]+)\s*(\d{1,2})\s*(\d{4})/);
  if (m) {
    const month = MONTHS_PARSE[m[1]] || 0;
    if (month) {
      return `${m[3]}-${String(month).padStart(2, '0')}-${String(Number(m[2])).padStart(2, '0')}`;
    }
  }

  return '';
}

/**
 * Format alamat/tempat: kapital di huruf awal tiap kata.
 * Contoh:
 * - "dusun 2, desa belimbing jaya" -> "Dusun 2, Desa Belimbing Jaya"
 * - "Dusun Sarip,desa Karangasem,rt 7 RW 5,kec.wirosari,kab.grobogan"
 *   -> "Dusun Sarip, Desa Karangasem, RT 7 RW 5, Kec. Wirosari, Kab. Grobogan"
 */
export function formatAddress(raw) {
  let value = String(raw || '').trim();
  if (!value || value === '-') return '';

  value = normalizeAddressSpacing(value);
  value = normalizePlacePhrases(value);

  return value
    .split(/(\s+)/)
    .map((token) => {
      if (/^\s+$/.test(token)) return token;
      return formatAddressToken(token);
    })
    .join('')
    .replace(/\s+,/g, ',')
    .replace(/,\s*/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Rapikan spasi & singkatan alamat yang sering nempel.
 * kec.wirosari -> kec. wirosari | rt7 -> rt 7 | ,desa -> , desa
 */
function normalizeAddressSpacing(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/,/g, ', ')
    // Singkatan + titik nempel nama: kec.wirosari / kab.grobogan / kel.xxx / jl.xxx
    .replace(
      /\b(kec|kel|kab|prov|jl|jln|ds|gg|no)\.\s*/gi,
      (_, abbr) => `${abbr.toLowerCase()}. `,
    )
    // Tanpa titik tapi nempel: kecwirosari jarang; lebih umum kec.xxx sudah di atas
    // RT/RW nempel angka: rt7 / rw5 / RT7
    .replace(/\b(rt|rw)\s*[.\-]?\s*(\d+)/gi, (_, label, num) => `${label.toUpperCase()} ${num}`)
    .replace(/\s{2,}/g, ' ')
    .replace(/,\s*,/g, ',')
    .trim();
}

/**
 * Rapikan frasa tempat yang sering salah/bervariasi.
 */
function normalizePlacePhrases(value) {
  return String(value || '')
    // Kediaman Mempelai Laki-Laki / Laki Laki / Laki-laki -> Kediaman Mempelai Pria
    .replace(
      /kediaman\s+mempelai\s+laki[-\s]*laki/gi,
      'Kediaman Mempelai Pria',
    )
    .replace(
      /rumah\s+mempelai\s+laki[-\s]*laki/gi,
      'Kediaman Mempelai Pria',
    )
    // Variasi wanita (rapikan penulisan)
    .replace(
      /kediaman\s+mempelai\s+perempuan/gi,
      'Kediaman Mempelai Wanita',
    )
    .replace(
      /kediaman\s+mempelai\s+wanita/gi,
      'Kediaman Mempelai Wanita',
    )
    .replace(
      /rumah\s+mempelai\s+wanita/gi,
      'Kediaman Mempelai Wanita',
    )
    .replace(
      /rumah\s+mempelai\s+perempuan/gi,
      'Kediaman Mempelai Wanita',
    )
    // Istilah wilayah umum
    .replace(/\bdesa\b/gi, 'Desa')
    .replace(/\bdusun\b/gi, 'Dusun')
    .replace(/\bkelurahan\b/gi, 'Kelurahan')
    .replace(/\bkecamatan\b/gi, 'Kecamatan')
    .replace(/\bkabupaten\b/gi, 'Kabupaten')
    .replace(/\bkota\b/gi, 'Kota');
}

function formatAddressToken(token) {
  // Keep punctuation attached: "jaya," "belimbing."
  const m = String(token).match(/^([("']*)(.*?)([).,",;:!?]*)$/);
  if (!m) return token;
  const [, lead, core, trail] = m;
  if (!core) return token;

  // "kec." / "kab." already split; core may be "kec." with trailing dot in core
  const lowerBare = core.toLowerCase().replace(/\./g, '');
  const abbr = {
    rm: 'Rm.',
    kec: 'Kec.',
    kel: 'Kel.',
    kab: 'Kab.',
    prov: 'Prov.',
    jl: 'Jl.',
    jln: 'Jl.',
    ds: 'Ds.',
    gg: 'Gg.',
    no: 'No.',
    rt: 'RT',
    rw: 'RW',
  };

  if (abbr[lowerBare]) {
    let out = abbr[lowerBare];
    // Avoid "Rm.." when input already had a trailing dot
    if (out.endsWith('.') && (trail.startsWith('.') || core.endsWith('.'))) {
      const extraDot = trail.startsWith('.') ? trail.slice(1) : trail;
      return `${lead}${out}${extraDot}`;
    }
    return `${lead}${out}${trail}`;
  }

  // Numbers / Roman numerals stay uppercase (2, III, IV, XII)
  if (/^\d+[a-z]?$/i.test(core) || isRomanNumeral(core)) {
    return `${lead}${core.toUpperCase()}${trail}`;
  }

  const titled = core.charAt(0).toUpperCase() + core.slice(1).toLowerCase();
  return `${lead}${titled}${trail}`;
}

function capitalizeWord(word) {
  const w = String(word || '');
  if (!w) return '';

  // Strip trailing punctuation for roman check, then restore
  const m = w.match(/^([("']*)(.*?)([).,",;:!?]*)$/);
  const lead = m?.[1] || '';
  const core = m?.[2] || w;
  const trail = m?.[3] || '';

  if (isRomanNumeral(core)) {
    return `${lead}${core.toUpperCase()}${trail}`;
  }

  return `${lead}${core.charAt(0).toUpperCase()}${core.slice(1).toLowerCase()}${trail}`;
}

/**
 * Deteksi angka Romawi valid (I, II, III, IV, V, ..., XII, XIII, dll).
 */
function isRomanNumeral(value) {
  const v = String(value || '').trim();
  if (!v) return false;
  // Must contain only roman letters
  if (!/^[mdclxvi]+$/i.test(v)) return false;
  // Classic Roman numeral pattern
  return /^(?=[mdclxvi])m*(c[md]|d?c{0,3})(x[cl]|l?x{0,3})(i[xv]|v?i{0,3})$/i.test(v);
}
