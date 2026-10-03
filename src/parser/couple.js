/**
 * Resolusi slot form mempelai.
 * Beberapa template menempatkan slot "wanita"/"pria" terbalik di layout,
 * jadi data perlu ditukar saat mengisi form.
 */

/**
 * @param {object} data
 * @returns {{ formWanita: object, formPria: object, swapped: boolean }}
 */
export function resolveCoupleFormSlots(data) {
  const bride = data?.bride || {};
  const groom = data?.groom || {};
  const swapped = Boolean(data?.swapCoupleForms);

  if (swapped) {
    return {
      formWanita: groom,
      formPria: bride,
      swapped: true,
    };
  }

  return {
    formWanita: bride,
    formPria: groom,
    swapped: false,
  };
}

/**
 * Toggle / set flag tukar form tanpa mengubah data asli bride/groom.
 * @param {object} data
 * @param {boolean} [force]
 */
export function withCoupleFormSwap(data, force) {
  const next = { ...(data || {}) };
  if (typeof force === 'boolean') {
    next.swapCoupleForms = force;
  } else {
    next.swapCoupleForms = !next.swapCoupleForms;
  }
  return next;
}

/**
 * Deteksi dari teks gondongan apakah form perlu ditukar.
 */
export function detectCoupleFormSwap(text) {
  const t = String(text || '');
  if (
    /tukar\s+(form|posisi)\s*(pria|wanita|mempelai)?/i.test(t) ||
    /posisi\s+(nama\s+)?(template\s+)?terbalik/i.test(t) ||
    /form\s+(pria\s+)?(dan\s+)?wanita\s+terbalik/i.test(t) ||
    /swap\s+(couple|form|bride|groom)/i.test(t)
  ) {
    return true;
  }

  const explicit = t.match(
    /(?:tukar\s+form|posisi\s+template|form\s+terbalik|swap\s+form)\s*:\s*(.+)$/im,
  )?.[1];
  if (explicit) {
    return /^(ya|yes|y|true|1|terbalik|tukar)$/i.test(explicit.trim());
  }

  return false;
}
