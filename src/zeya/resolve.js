/**
 * Resolve theme/music names against website catalog.
 */

export async function resolveTemplateByTheme(invitation, themeName, categoryId = '') {
  const wanted = normalizeName(themeName);
  if (!wanted) {
    return null;
  }

  let categoryIds = [String(categoryId || ''), '156', '70', '44', '114'].filter(
    (v, i, arr) => v && arr.indexOf(v) === i,
  );

  try {
    const cats = await invitation.listCategories();
    categoryIds = [
      ...categoryIds,
      ...cats.map((c) => String(c.id)),
    ].filter((v, i, arr) => v && arr.indexOf(v) === i);
  } catch {
    // ignore — tetap coba id default
  }

  let bestSoft = null;

  for (const cat of categoryIds) {
    const templates = await invitation.listTemplates(cat);
    const exact = templates.find((t) => normalizeName(t.name) === wanted);
    if (exact) {
      return {
        ...exact,
        categoryId: exact.categoryId || cat,
      };
    }

    const soft = templates.find((t) => {
      const name = normalizeName(t.name);
      return name.includes(wanted) || wanted.includes(name);
    });
    if (soft && !bestSoft) {
      bestSoft = {
        ...soft,
        categoryId: soft.categoryId || cat,
      };
    }
  }

  return bestSoft;
}

export async function resolveMusicByTitle(editor, postId, musicTitle) {
  const html = await editor.getEditPage(postId);
  return pickMusicUrl(html, musicTitle);
}

/** Pure helper — bisa di-test tanpa login */
export function pickMusicUrl(html, musicTitle) {
  const wanted = normalizeName(musicTitle);
  if (!wanted) return '';

  const options = extractMusicOptions(html);
  if (!options.length) return '';

  const exact = options.find((o) => normalizeName(o.label) === wanted);
  if (exact) return exact.music || exact.value;

  const soft = options.find((o) => {
    const label = normalizeName(o.label);
    if (label.length < 6 || wanted.length < 6) return false;
    if (label.includes(wanted)) return true;
    if (wanted.includes(label) && label.length >= Math.min(wanted.length, 12)) return true;
    return false;
  });
  if (soft) return soft.music || soft.value;

  let best = null;
  let bestScore = 0;
  for (const opt of options) {
    const label = normalizeName(opt.label);
    if (!label) continue;
    const score = scoreMusicMatch(wanted, label);
    if (score > bestScore) {
      bestScore = score;
      best = opt;
    }
  }

  if (best && bestScore >= 0.55) {
    return best.music || best.value;
  }

  return '';
}

export function extractMusicOptions(html) {
  const options = [];
  const seen = new Set();
  const push = (value, music, labelRaw) => {
    const label = String(labelRaw || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const key = `${value}|${music}|${label}`;
    if (!value || seen.has(key)) return;
    seen.add(key);
    options.push({ value, music: music || value, label });
  };

  let m;
  const reMusic =
    /<option[^>]*value=["']([^"']+)["'][^>]*data-music=["']([^"']+)["'][^>]*>([\s\S]*?)<\/option>/gi;
  while ((m = reMusic.exec(html))) {
    push(m[1], m[2], m[3]);
  }

  // InvMoment / WDS 2.9 audio modal uses data-audio
  const reAudio =
    /<option[^>]*value=["']([^"']+)["'][^>]*data-audio=["']([^"']+)["'][^>]*>([\s\S]*?)<\/option>/gi;
  while ((m = reAudio.exec(html))) {
    push(m[1], m[2], m[3]);
  }

  if (!options.length) {
    const re2 = /<option[^>]*value=["']([^"']+\.mp3[^"']*)["'][^>]*>([\s\S]*?)<\/option>/gi;
    while ((m = re2.exec(html))) {
      push(m[1], m[1], m[2]);
    }
  }

  return options;
}

function scoreMusicMatch(wantedNorm, labelNorm) {
  const w = tokens(wantedNorm);
  const l = tokens(labelNorm);
  if (!w.length || !l.length) return 0;

  const matched = w.filter((t) => l.includes(t));
  if (matched.length < Math.min(2, w.length)) return 0;

  const titleish = w.filter((t) => !ARTIST_STOP.has(t) && t.length > 2);
  if (titleish.length) {
    const titleHit = titleish.filter((t) => l.includes(t)).length;
    if (titleHit / titleish.length < 0.5) return 0;
  }

  const precision = matched.length / w.length;
  const coverage = matched.length / Math.max(l.length, 1);
  let score = precision * 0.75 + coverage * 0.25;

  if (/\borchestr/.test(labelNorm) && !/\borchestr/.test(wantedNorm)) {
    score *= 0.85;
  }

  return score;
}

const ARTIST_STOP = new Set([
  'by',
  'ft',
  'feat',
  'official',
  'lyric',
  'lyrics',
  'video',
  'audio',
  'cover',
  'orchestra',
  'orchestral',
  'mp3cut',
  'net',
]);

function tokens(norm) {
  return String(norm || '')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !ARTIST_STOP.has(t));
}

function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[“”"']/g, '')
    .replace(/ahkir/g, 'akhir')
    .replace(/orkestra/g, 'orchestra')
    .replace(/heritage/g, 'haritage')
    // Premium 03 ↔ Premium 3
    .replace(/\b0+(\d+)\b/g, '$1')
    .replace(/[()[\]{}]/g, ' ')
    .replace(/[–—−_/|,;:]+/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
