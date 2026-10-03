/**
 * Teks doa / ayat sesuai agama untuk form edit undangan.
 */

export const RELIGION_TEXTS = {
  kristen: {
    label: 'Kristen',
    non_muslim_surat:
      '"Demikianlah mereka bukan lagi dua, melainkan satu. Karena itu, apa yang telah dipersatukan Allah, tidak boleh diceraikan manusia."\nMatius 19:6',
    non_muslim_kata_pengantar:
      'Salam Sejahtera\nDengan Rahmat Tuhan Yang Maha Esa, kami mengundang Bapak/Ibu/Saudara/i untuk menghadiri pernikahan putra-putri kami',
    teks_quotes:
      '"Demikianlah mereka bukan lagi dua, melainkan satu. Karena itu, apa yang telah dipersatukan Allah, tidak boleh diceraikan manusia." — Matius 19:6',
    teks_pembuka:
      'Dengan penuh sukacita dan ucapan syukur kepada Tuhan Yesus Kristus, kami bermaksud mengundang Bapak/Ibu/Saudara/i untuk menghadiri acara pemberkatan pernikahan kami.',
    teks_penutup:
      'Atas kehadiran dan doa restunya kami mengucapkan terima kasih. Tuhan memberkati.',
  },
  katolik: {
    label: 'Katolik',
    non_muslim_surat:
      '"Demikianlah mereka bukan lagi dua, melainkan satu. Karena itu, apa yang telah dipersatukan Allah, tidak boleh diceraikan manusia."\nMatius 19:6',
    non_muslim_kata_pengantar:
      'Salam Sejahtera dalam kasih Kristus\nDengan rahmat Tuhan yang Maha Esa, kami mengundang Bapak/Ibu/Saudara/i untuk menghadiri pemberkatan pernikahan putra-putri kami',
    teks_quotes:
      '"Demikianlah mereka bukan lagi dua, melainkan satu. Karena itu, apa yang telah dipersatukan Allah, tidak boleh diceraikan manusia." — Matius 19:6',
    teks_pembuka:
      'Dengan penuh sukacita dan ucapan syukur kepada Tuhan Yesus Kristus, kami bermaksud mengundang Bapak/Ibu/Saudara/i untuk menghadiri acara pemberkatan pernikahan kami.',
    teks_penutup:
      'Atas kehadiran dan doa restunya kami mengucapkan terima kasih. Tuhan memberkati.',
  },
  hindu: {
    label: 'Hindu',
    hindu_surat:
      'Om Swastyastu\nSemoga Ida Sang Hyang Widhi Wasa senantiasa melimpahkan rahmat-Nya.',
    hindu_kata_pengantar:
      'Om Swastyastu\nDengan memohon rahmat Ida Sang Hyang Widhi Wasa, kami mengundang Bapak/Ibu/Saudara/i untuk menghadiri upacara pernikahan putra-putri kami.',
    teks_quotes:
      'Om Swastyastu — Semoga Ida Sang Hyang Widhi Wasa senantiasa melimpahkan rahmat-Nya.',
    teks_pembuka:
      'Om Swastyastu. Dengan memohon rahmat Ida Sang Hyang Widhi Wasa, kami bermaksud mengundang Bapak/Ibu/Saudara/i pada upacara pernikahan kami.',
    teks_penutup: 'Om Shanti Shanti Shanti Om. Atas kehadiran dan doanya kami ucapkan terima kasih.',
  },
  islam: {
    label: 'Islam',
    // Biarkan default template — jangan timpa teks doa
  },
};

/**
 * Normalisasi label agama dari data gondongan.
 * @returns {'islam'|'kristen'|'katolik'|'hindu'|''}
 */
export function resolveReligionKey(raw) {
  const v = String(raw || '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!v) return '';

  if (/(katolik|catholic)/.test(v)) return 'katolik';
  if (/(kristen|protestan|christian|injili|pentakosta)/.test(v)) return 'kristen';
  if (/(non\s*muslim|nonmuslim)/.test(v)) return 'kristen';
  if (/(hindu)/.test(v)) return 'hindu';
  if (/(islam|muslim|moslem)/.test(v)) return 'islam';
  return '';
}

export function getReligionTexts(rawReligion) {
  const key = resolveReligionKey(rawReligion);
  if (!key) return { key: '', texts: null };
  return { key, texts: RELIGION_TEXTS[key] || null };
}
