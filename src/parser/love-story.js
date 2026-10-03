/**
 * Parser & formatter love story undangan.
 *
 * Format wajib: baris judul diakhiri (JUDUL)
 *
 *   2013 — Awal Sebuah Cerita (JUDUL)
 *   paragraf...
 *
 *   Lamaran — Sebuah Janji (JUDUL)
 *   paragraf...
 */

const JUDUL_MARKER_RE = /\(\s*judul\s*\)\s*$/i;

/**
 * Parse blok love story.
 * Hanya baris yang berakhiran (JUDUL) yang dianggap judul bab.
 */
export function parseLoveStories(rawText) {
  const text = String(rawText || '').replace(/\r/g, '').trim();
  if (!text) return [];

  const section =
    text.match(
      /love\s*story[\s\S]*?(?=\n\s*\(\d+\)\s*(?:wanita|pria|akad|resepsi)|catatan\s*:|$)/i,
    )?.[0] || text;

  const headings = findJudulHeadings(section);
  if (!headings.length) return [];

  const stories = [];
  for (let i = 0; i < headings.length; i += 1) {
    const start = headings[i].end;
    let end = i + 1 < headings.length ? headings[i + 1].start : section.length;
    if (i + 1 >= headings.length) {
      const rest = section.slice(start, end);
      const cut = rest.search(
        /\n\s*(?:\(?\d+\)?\s*)?(?:wanita|pria|akad|resepsi|ngunduh|amplop|rekening|catatan|musik|youtube|tema)\b/i,
      );
      if (cut >= 0) end = start + cut;
    }
    const body = cleanStoryBody(section.slice(start, end));
    if (!body) continue;
    stories.push({
      title: headings[i].title,
      date: '',
      description: body,
    });
    if (stories.length >= 4) break;
  }

  return stories.slice(0, 4);
}

function findJudulHeadings(section) {
  const lines = section.split('\n');
  const headings = [];
  let cursor = 0;

  for (const rawLine of lines) {
    const lineStart = cursor;
    cursor += rawLine.length + 1;
    const line = rawLine.trim();
    if (!line || !JUDUL_MARKER_RE.test(line)) continue;

    const title = cleanHeadingTitle(line.replace(JUDUL_MARKER_RE, '').trim());
    if (!title) continue;

    headings.push({
      title,
      start: lineStart,
      end: lineStart + rawLine.length,
    });
    if (headings.length >= 4) break;
  }

  return headings;
}

function cleanHeadingTitle(raw) {
  return String(raw || '')
    .replace(/\s*[—–]\s*/g, ' — ')
    .replace(/\s+-\s+/g, ' — ')
    .replace(/\s+/g, ' ')
    .replace(/:$/, '')
    .trim();
}

export function looksLikeLoveStory(text) {
  const t = String(text || '');
  return (
    /\(\s*judul\s*\)/i.test(t) ||
    /love\s*story/i.test(t) ||
    /cerita\s*cinta/i.test(t)
  );
}

export function formatLoveStorySummary(stories, extras = {}) {
  const list = Array.isArray(stories) ? stories : [];
  return [
    '*Ringkasan Love Story*',
    extras.slug ? `Slug: ${extras.slug}` : null,
    extras.postId ? `Post ID: ${extras.postId}` : null,
    `Cerita: ${list.length}`,
    '',
    ...(list.length
      ? list.map(
          (s, i) =>
            `${i + 1}. ${s.title} — ${String(s.description || '').slice(0, 80)}...`,
        )
      : ['(kosong)']),
  ]
    .filter((x) => x !== null)
    .join('\n');
}

function cleanStoryBody(raw) {
  return String(raw || '')
    .replace(/^\s*[:\-–—]+\s*/gm, '')
    .replace(/([.!?])([A-Za-zÀ-ÿ])/g, '$1 $2')
    .replace(/([A-Za-z])(\d{4})\b/g, '$1 $2')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
}
