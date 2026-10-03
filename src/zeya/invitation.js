import FormData from 'form-data';
import { config } from '../config.js';
import { extractNonceFromHtml } from './auth.js';

function stripHtml(text) {
  return String(text || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildGuestLink(slug, guestName) {
  const cleanSlug = String(slug || '')
    .trim()
    .replace(/^\/+|\/+$/g, '');
  const encoded = encodeURIComponent(String(guestName || '').trim());
  return `${config.zeya.baseUrl}/${cleanSlug}/?to=${encoded}`;
}

export function buildInvitationLink(slug) {
  const cleanSlug = String(slug || '')
    .trim()
    .replace(/^\/+|\/+$/g, '');
  return `${config.zeya.baseUrl}/${cleanSlug}/`;
}

export function parseGuestNames(raw) {
  return String(raw || '')
    .split(/[\n,;]+/)
    .map((n) => n.trim())
    .filter(Boolean);
}

export class ZeyaInvitation {
  constructor(auth) {
    this.auth = auth;
  }

  async getCreatePage() {
    await this.auth.ensureLogin();
    const client = this.auth.getClient();
    const res = await client.get('/dashboard/invitation/create/', {
      headers: { Accept: 'text/html' },
    });

    if (res.status !== 200) {
      throw new Error(`Gagal buka halaman create (HTTP ${res.status})`);
    }

    const html = String(res.data || '');
    if (html.includes('id="wds_auth_form"')) {
      await this.auth.ensureLogin({ force: true });
      return this.getCreatePage();
    }

    return html;
  }

  async listCategories() {
    await this.auth.ensureLogin();
    const createHtml = await this.getCreatePage();

    if (config.zeya.api === 'wds') {
      const nonce = extractNonceFromHtml(createHtml);
      const rows = await this.runWds('invitation_get_category', { __nonce: nonce });
      const list = Array.isArray(rows) ? rows : [];
      return list
        .filter((row) => row?.ID)
        .map((row) => ({ id: String(row.ID), name: row.name || String(row.ID) }));
    }

    const client = this.auth.getClient();
    const nonceMatch = createHtml.match(
      /weddingsaas_get_invitation_category&nonce=([a-f0-9]+)/i,
    );
    const nonce = nonceMatch?.[1];
    if (!nonce) {
      return [
        { id: '70', name: 'Pernikahan Elementor' },
        { id: '156', name: 'Non Pernikahan' },
      ];
    }

    const res = await client.get('/wp-admin/admin-ajax.php', {
      params: {
        action: 'weddingsaas_get_invitation_category',
        nonce,
      },
    });

    let rows = Array.isArray(res.data) ? res.data : [];
    if (!rows.length) {
      const body = new URLSearchParams({
        action: 'weddingsaas_get_invitation_category',
      });
      const postRes = await client.post(
        `/wp-admin/admin-ajax.php?action=weddingsaas_get_invitation_category&nonce=${nonce}`,
        body.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Requested-With': 'XMLHttpRequest',
          },
        },
      );
      rows = Array.isArray(postRes.data) ? postRes.data : [];
    }
    return rows
      .filter((row) => row?.ID)
      .map((row) => ({ id: String(row.ID), name: row.name || String(row.ID) }));
  }

  async listTemplates(categoryId, { subthemeId = '', subcategoryId = '' } = {}) {
    await this.auth.ensureLogin();
    const createHtml = await this.getCreatePage();

    if (config.zeya.api === 'wds') {
      const nonce = extractNonceFromHtml(createHtml);
      const rows = await this.runWds('invitation_get_theme', {
        __nonce: nonce,
        category: String(categoryId || ''),
        subcategory: String(subcategoryId || ''),
        subtheme: String(subthemeId || ''),
        orderby: '',
      });
      const templates = normalizeTemplateResponse(rows);
      return templates.map((t) => ({ ...t, categoryId: String(categoryId || '') }));
    }

    const client = this.auth.getClient();
    const themeNonce =
      createHtml.match(/weddingsaas_get_invitation_theme&nonce=([a-f0-9]+)/i)?.[1] || '';
    if (!themeNonce) {
      return parseTemplateOptions(createHtml);
    }

    const body = new URLSearchParams({
      action: 'weddingsaas_get_invitation_theme',
      category: String(categoryId || ''),
      subcategory: String(subcategoryId || ''),
      subtheme: String(subthemeId || ''),
    });

    const res = await client.post(
      `/wp-admin/admin-ajax.php?action=weddingsaas_get_invitation_theme&nonce=${themeNonce}`,
      body.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest',
          Referer: `${config.zeya.baseUrl}/dashboard/invitation/create/`,
        },
      },
    );

    const templates = normalizeTemplateResponse(res.data);
    if (templates.length) {
      return templates;
    }

    return parseTemplateOptions(createHtml);
  }

  /** WeddingSaas Pro 2.9+ — action=run_wds */
  async runWds(name, fields = {}) {
    const client = this.auth.getClient();
    const body = new URLSearchParams({
      name: String(name),
      action: 'run_wds',
      ...Object.fromEntries(
        Object.entries(fields).map(([k, v]) => [k, v == null ? '' : String(v)]),
      ),
    });
    const res = await client.post('/wp-admin/admin-ajax.php', body.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
        Referer: `${config.zeya.baseUrl}/dashboard/invitation/create/`,
      },
    });
    // Beberapa endpoint return array langsung, beberapa {success,data}
    if (Array.isArray(res.data)) return res.data;
    if (res.data?.success === false) {
      throw new Error(
        typeof res.data.data === 'string'
          ? res.data.data
          : res.data.data?.message || 'run_wds gagal',
      );
    }
    return res.data?.data ?? res.data;
  }

  async listSubthemes(categoryId, subcategoryId = '') {
    await this.auth.ensureLogin();
    const client = this.auth.getClient();
    const createHtml = await this.getCreatePage();
    const nonce =
      createHtml.match(/weddingsaas_get_invitation_subtheme&nonce=([a-f0-9]+)/i)?.[1] || '';
    if (!nonce) return [];

    const body = new URLSearchParams({
      action: 'weddingsaas_get_invitation_subtheme',
      category: String(categoryId || ''),
      subcategory: String(subcategoryId || ''),
    });

    const res = await client.post(
      `/wp-admin/admin-ajax.php?action=weddingsaas_get_invitation_subtheme&nonce=${nonce}`,
      body.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest',
          Referer: `${config.zeya.baseUrl}/dashboard/invitation/create/`,
        },
      },
    );

    return normalizeTemplateResponse(res.data);
  }

  async createInvitation({
    title,
    slug,
    categoryId,
    templateId,
    templateName = '',
    taxonomy = '',
  }) {
    if (!title || !slug || !categoryId || !templateId) {
      throw new Error('title, slug, categoryId, dan templateId wajib diisi');
    }

    await this.auth.ensureLogin();
    const html = await this.getCreatePage();
    const nonce = extractNonceFromHtml(html);
    if (!nonce) {
      throw new Error('Gagal ambil __nonce dari form buat undangan');
    }

    let resolvedTemplateName = templateName;
    let resolvedTaxonomy = taxonomy;
    if (!resolvedTemplateName || !resolvedTaxonomy) {
      const templates = await this.listTemplates(categoryId);
      const found = templates.find((t) => String(t.id) === String(templateId));
      resolvedTemplateName = resolvedTemplateName || found?.name || String(templateId);
      resolvedTaxonomy = resolvedTaxonomy || found?.taxonomy || '';
    }

    const form = new FormData();
    form.append('title', title);
    form.append('slug', slug);
    form.append('category', String(categoryId));
    form.append('taxonomy', resolvedTaxonomy || '');
    form.append('template', String(templateId));
    // InvMoment (WDS) pakai template_name; Zeya legacy pakai templateName
    form.append('template_name', resolvedTemplateName);
    form.append('templateName', resolvedTemplateName);
    form.append('__nonce', nonce);
    form.append('_wp_http_referer', '/dashboard/invitation/create/');

    if (config.zeya.api === 'wds') {
      form.append('name', 'invitation_add');
      form.append('action', 'run_wds');
    } else {
      form.append('action', 'add_invitation_ajax_action');
    }

    const client = this.auth.getClient();
    const res = await client.post('/wp-admin/admin-ajax.php', form, {
      headers: {
        ...form.getHeaders(),
        'X-Requested-With': 'XMLHttpRequest',
        Referer: `${config.zeya.baseUrl}/dashboard/invitation/create/`,
      },
      maxBodyLength: Infinity,
    });

    this.auth.persist();

    const data = res.data;
    if (!data?.success) {
      const message =
        data?.message ||
        data?.data?.message ||
        (typeof data?.data === 'string' ? data.data : null) ||
        JSON.stringify(data);
      throw new Error(`Gagal buat undangan: ${stripHtml(message)}`);
    }

    let postId = extractPostIdFromCreateResponse(data);

    // Fallback: cari di daftar undangan by slug (WDS kadang tidak kirim redirect)
    if (!postId) {
      try {
        const found = await this.findInvitation(slug);
        postId = found?.postId || '';
      } catch {
        // ignore
      }
    }

    if (!postId) {
      throw new Error(
        `Create sukses tapi postId tidak ditemukan. Slug: ${slug}. Coba /update ${slug}`,
      );
    }

    return {
      success: true,
      message: stripHtml(
        data.message ||
          (typeof data.data === 'string' ? data.data : data.data?.message) ||
          'Undangan berhasil dibuat',
      ),
      link: buildInvitationLink(slug),
      slug,
      postId: String(postId),
      redirect: extractRedirectFromCreateResponse(data),
      raw: data,
    };
  }

  generateGuestLinks(slug, names) {
    const guests = Array.isArray(names) ? names : parseGuestNames(names);
    return guests.map((name) => ({
      name,
      link: buildGuestLink(slug, name),
    }));
  }

  async listInvitations({ maxPages = 8 } = {}) {
    await this.auth.ensureLogin();
    const client = this.auth.getClient();
    const items = [];
    const seen = new Set();

    for (let page = 1; page <= maxPages; page += 1) {
      const path =
        page === 1 ? '/dashboard/invitation/' : `/dashboard/invitation/?page=${page}`;
      const res = await client.get(path, { headers: { Accept: 'text/html' } });
      if (res.status !== 200) break;
      const html = String(res.data || '');
      if (html.includes('id="wds_auth_form"')) {
        await this.auth.ensureLogin({ force: true });
        page -= 1;
        continue;
      }

      const pageItems = parseInvitationCards(html);
      if (!pageItems.length) break;

      let added = 0;
      for (const item of pageItems) {
        const key = `${item.postId}:${item.slug}`;
        if (seen.has(key)) continue;
        seen.add(key);
        items.push(item);
        added += 1;
      }

      // stop if no next page markers and few items
      if (!html.includes(`page=${page + 1}`) && added === 0) break;
      if (!html.match(new RegExp(`[?&]page=${page + 1}\\b`)) && pageItems.length < 3) {
        // likely last page
      }
    }

    return items;
  }

  async findInvitation(slugOrId) {
    const query = String(slugOrId || '')
      .trim()
      .replace(/^\/+|\/+$/g, '');
    if (!query) return null;

    if (/^\d+$/.test(query)) {
      // Prefer dashboard list first (reliable slug mapping)
      const list = await this.listInvitations();
      const fromList = list.find((item) => item.postId === query);
      if (fromList) {
        return fromList;
      }

      // Validate edit page exists
      await this.auth.ensureLogin();
      const client = this.auth.getClient();
      const res = await client.get(`/dashboard/invitation/edit/?id=${query}`, {
        headers: { Accept: 'text/html' },
        validateStatus: () => true,
      });
      if (res.status !== 200) return null;
      const html = String(res.data || '');
      if (html.includes('id="wds_auth_form"')) return null;
      const title =
        html.match(/<title>\s*Edit\s+([^|<]+)/i)?.[1]?.trim() ||
        html.match(/name=["']judul_undangan["'][^>]*value=["']([^"']+)["']/i)?.[1] ||
        html.match(/value=["']([^"']+)["'][^>]*name=["']judul_undangan["']/i)?.[1] ||
        '';

      let slug =
        html.match(/name=["']_slug["'][^>]*value=["']([^"']+)["']/i)?.[1] ||
        html.match(/value=["']([^"']+)["'][^>]*name=["']_slug["']/i)?.[1] ||
        '';

      if (!slug) {
        const candidates = [
          ...html.matchAll(/https?:\/\/zeyainvitation\.com\/([a-z0-9-]+)\/(?:\?|#|"|'|\s)/gi),
        ]
          .map((m) => m[1])
          .filter(
            (s) =>
              s &&
              ![
                'dashboard',
                'account',
                'wp-content',
                'wp-admin',
                'wp-includes',
                'share',
                'auth',
                'checkout',
              ].includes(s),
          );
        slug = candidates[0] || '';
      }

      return {
        postId: query,
        slug,
        title: stripHtml(title).replace(/&amp;/g, '&'),
      };
    }

    const slug = query.toLowerCase();
    const list = await this.listInvitations();
    const found = list.find((item) => item.slug.toLowerCase() === slug);
    return found || null;
  }
}

function parseInvitationCards(html) {
  const items = [];
  // Public link then edit id (common card order)
  const reA =
    /https?:\/\/zeyainvitation\.com\/([a-z0-9-]+)\/(?:\?to=[^"']*)?["'][\s\S]{0,900}?dashboard\/invitation\/edit\/\?id=(\d+)/gi;
  let m;
  while ((m = reA.exec(html))) {
    items.push({ slug: m[1], postId: m[2], title: '' });
  }

  // edit id then share id
  const reB =
    /dashboard\/invitation\/edit\/\?id=(\d+)[\s\S]{0,900}?share\/\?id=([a-z0-9-]+)/gi;
  while ((m = reB.exec(html))) {
    items.push({ postId: m[1], slug: m[2], title: '' });
  }

  // dedupe by postId
  const map = new Map();
  for (const item of items) {
    if (!item.postId || !item.slug) continue;
    if (['dashboard', 'account', 'wp-content', 'share'].includes(item.slug)) continue;
    map.set(String(item.postId), {
      postId: String(item.postId),
      slug: String(item.slug),
      title: item.title || '',
    });
  }
  return [...map.values()];
}

function normalizeTemplateResponse(data) {
  if (!data) return [];

  if (Array.isArray(data)) {
    return data
      .map((row) => ({
        id: String(row.ID ?? row.id ?? row.value ?? ''),
        name: stripHtml(
          row.name || row.post_title || row.title || row.text || row.ID || row.id || '',
        ),
        taxonomy: row.taxonomy || row.tax || '',
        categoryId: row.category?.id ? String(row.category.id) : '',
      }))
      .filter((row) => row.id);
  }

  if (data?.success === false) {
    return [];
  }

  if (Array.isArray(data?.data)) {
    return normalizeTemplateResponse(data.data);
  }

  if (typeof data?.data === 'string') {
    return parseTemplateOptions(data.data);
  }

  if (typeof data === 'string') {
    // HTML card markup fallback
    const fromDataAttrs = [];
    const re =
      /data-id=["'](\d+)["'][^>]*data-name=["']([^"']*)["'][^>]*data-taxonomy=["']([^"']*)["']/gi;
    let match;
    while ((match = re.exec(data))) {
      fromDataAttrs.push({
        id: match[1],
        name: stripHtml(match[2]),
        taxonomy: match[3] || '',
        categoryId: '',
      });
    }
    if (fromDataAttrs.length) return fromDataAttrs;
    return parseTemplateOptions(data);
  }

  return [];
}

function parseTemplateOptions(html) {
  const options = [];
  const re = /<option[^>]*value=["']([^"']+)["'][^>]*>([\s\S]*?)<\/option>/gi;
  let match;
  while ((match = re.exec(html))) {
    const id = match[1];
    const name = stripHtml(match[2]);
    if (!id) continue;
    options.push({ id: String(id), name: name || String(id) });
  }
  return options;
}

function extractRedirectFromCreateResponse(raw) {
  if (!raw || typeof raw !== 'object') return '';
  const candidates = [
    raw.redirect,
    raw.data?.redirect,
    raw.data?.url,
    raw.url,
    raw.data?.data?.redirect,
  ];
  for (const c of candidates) {
    if (c && typeof c === 'string') return c;
  }
  return '';
}

function extractPostIdFromCreateResponse(raw) {
  if (!raw || typeof raw !== 'object') return '';

  const direct = [
    raw.post_id,
    raw.postId,
    raw.id,
    raw.data?.post_id,
    raw.data?.postId,
    raw.data?.id,
    raw.data?.invitation_id,
  ];
  for (const v of direct) {
    if (v != null && /^\d+$/.test(String(v))) return String(v);
  }

  const redirect = extractRedirectFromCreateResponse(raw);
  if (redirect) {
    try {
      const id = new URL(redirect, 'https://example.com').searchParams.get('id');
      if (id && /^\d+$/.test(id)) return id;
    } catch {
      // ignore
    }
    const m =
      String(redirect).match(/[?&]id=(\d+)/) ||
      String(redirect).match(/edit\/?\?id=(\d+)/);
    if (m?.[1]) return m[1];
  }

  // Scan JSON string for edit/?id=
  const blob = JSON.stringify(raw);
  const fromBlob = blob.match(/invitation\/edit\/?\?id=(\d+)/i);
  if (fromBlob?.[1]) return fromBlob[1];

  return '';
}
