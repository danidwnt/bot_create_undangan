import fs from 'node:fs';
import path from 'node:path';
import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import FormData from 'form-data';
import {
  config,
  cookiePathForAccount,
  getZeyaAccountByQuery,
  switchSite as switchSiteConfig,
  listSites,
  getActiveSite,
} from '../config.js';

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function siteHost() {
  try {
    return new URL(config.zeya.baseUrl).hostname;
  } catch {
    return 'zeyainvitation.com';
  }
}

function loadCookieJar(cookieFile) {
  const jar = new CookieJar();
  if (!fs.existsSync(cookieFile)) {
    return jar;
  }

  try {
    const data = JSON.parse(fs.readFileSync(cookieFile, 'utf8'));
    if (Array.isArray(data)) {
      for (const cookie of data) {
        jar.setCookieSync(cookie, config.zeya.baseUrl);
      }
    }
  } catch {
    // ignore corrupt cookie file; login will refresh it
  }

  return jar;
}

function saveCookieJar(jar, cookieFile) {
  ensureDir(cookieFile);
  const host = siteHost();
  const serialized = jar.toJSON().cookies.map((c) => {
    const parts = [
      `${c.key}=${c.value}`,
      `Domain=${c.domain || host}`,
      `Path=${c.path || '/'}`,
    ];
    if (c.secure) parts.push('Secure');
    if (c.httpOnly) parts.push('HttpOnly');
    if (c.expires && c.expires !== 'Infinity') {
      parts.push(`Expires=${new Date(c.expires).toUTCString()}`);
    }
    return parts.join('; ');
  });
  fs.writeFileSync(cookieFile, JSON.stringify(serialized, null, 2));
}

/**
 * Cookie lama (single-account) milik akun Iyan sebelumnya → pindah ke cookies-2 saja.
 */
function migrateLegacyCookiesIfNeeded() {
  const legacy = config.paths.zeyaCookies;
  const cookies2 = cookiePathForAccount('2', 'zeya');
  if (!fs.existsSync(legacy)) return;
  if (fs.existsSync(cookies2)) return;
  try {
    ensureDir(cookies2);
    fs.copyFileSync(legacy, cookies2);
  } catch {
    // ignore
  }
}

function createClient(jar) {
  return wrapper(
    axios.create({
      jar,
      withCredentials: true,
      baseURL: config.zeya.baseUrl,
      timeout: 45000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'application/json, text/plain, */*',
      },
      validateStatus: () => true,
    }),
  );
}

function extractNonce(html) {
  const source = String(html || '');
  return (
    source.match(/name=["']__nonce["']\s+value=["']([^"']+)["']/i)?.[1] ||
    source.match(/value=["']([^"']+)["']\s+name=["']__nonce["']/i)?.[1] ||
    source.match(/["']ajax_nonce["']\s*:\s*["']([a-f0-9]+)["']/i)?.[1] ||
    ''
  );
}

function hasLoggedInCookie(jar) {
  const cookies = jar.toJSON().cookies || [];
  return cookies.some((c) => String(c.key || '').startsWith('wordpress_logged_in_'));
}

function maskEmail(email) {
  const e = String(email || '');
  const [user, domain] = e.split('@');
  if (!domain) return e;
  const safe = user.length <= 2 ? `${user[0] || '*'}*` : `${user.slice(0, 2)}***`;
  return `${safe}@${domain}`;
}

function extractLoggedInEmail(html) {
  const source = String(html || '');
  const patterns = [
    /name=["']email["'][^>]*value=["']([^"']+@[^"']+)["']/i,
    /value=["']([^"']+@[^"']+)["'][^>]*name=["']email["']/i,
    /type=["']email["'][^>]*value=["']([^"']+@[^"']+)["']/i,
    /([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i,
  ];
  for (const re of patterns) {
    const m = source.match(re);
    if (m?.[1] && /@/.test(m[1])) {
      if (/example\.com|zeyainvitation|invmoment|wixpress|schema\.org/i.test(m[1])) continue;
      return m[1].trim().toLowerCase();
    }
  }
  return '';
}

function readActiveAccountId() {
  try {
    if (!fs.existsSync(config.paths.zeyaActiveAccount)) return null;
    const data = JSON.parse(fs.readFileSync(config.paths.zeyaActiveAccount, 'utf8'));
    return data?.id ? String(data.id) : null;
  } catch {
    return null;
  }
}

function writeActiveAccountId(accountId) {
  ensureDir(config.paths.zeyaActiveAccount);
  fs.writeFileSync(
    config.paths.zeyaActiveAccount,
    JSON.stringify({ id: String(accountId), updatedAt: new Date().toISOString() }, null, 2),
  );
}

export class ZeyaAuth {
  constructor() {
    const accounts = config.zeya.accounts;
    if (!accounts.length) {
      throw new Error('Tidak ada akun website di .env');
    }

    migrateLegacyCookiesIfNeeded();

    const savedId = readActiveAccountId();
    const initial = accounts.find((a) => a.id === savedId) || accounts[0];

    this.account = initial;
    this.bindSession();
    writeActiveAccountId(this.account.id);
  }

  bindSession() {
    this.cookieFile = cookiePathForAccount(this.account.id, config.zeya.siteId);
    this.jar = loadCookieJar(this.cookieFile);
    this.client = createClient(this.jar);
  }

  listAccounts() {
    return config.zeya.accounts.map((a) => ({
      id: a.id,
      label: a.label,
      email: a.email,
      emailMasked: maskEmail(a.email),
      active: a.id === this.account.id,
    }));
  }

  getActiveAccount() {
    return {
      id: this.account.id,
      label: this.account.label,
      email: this.account.email,
      emailMasked: maskEmail(this.account.email),
    };
  }

  getActiveSite() {
    const site = getActiveSite();
    return {
      id: site.id,
      label: site.label,
      baseUrl: site.baseUrl,
      api: site.api,
    };
  }

  listSites() {
    return listSites();
  }

  /**
   * Ganti website (zeya / invmoment), lalu login ulang.
   */
  async switchSite(query) {
    const next = switchSiteConfig(query);
    if (!next) {
      const list = listSites()
        .map((s) => `${s.active ? '→' : ' '} ${s.id}. ${s.label} — ${s.baseUrl}`)
        .join('\n');
      throw new Error(`Website tidak ditemukan: ${query}\n\nDaftar:\n${list}`);
    }

    this.persist();
    this.bindSession();
    const login = await this.login();
    return {
      site: this.getActiveSite(),
      account: this.getActiveAccount(),
      login,
      message: `Website aktif: *${next.label}* (${next.baseUrl})\nAkun: *${this.account.label}* (${maskEmail(this.account.email)})`,
    };
  }

  async switchAccount(query) {
    const next = getZeyaAccountByQuery(query);
    if (!next) {
      const list = config.zeya.accounts
        .map((a) => `${a.id}. ${a.label} (${maskEmail(a.email)})`)
        .join('\n');
      throw new Error(`Akun tidak ditemukan: ${query}\n\nDaftar akun:\n${list}`);
    }

    this.persist();
    this.account = next;
    this.bindSession();
    writeActiveAccountId(next.id);

    const login = await this.login();
    const verified = await this.verifyActiveIdentity();
    if (!verified.ok) {
      throw new Error(
        `Gagal verifikasi akun. Diharapkan ${maskEmail(next.email)}, tapi session: ${verified.found || 'tidak terdeteksi'}. Coba /akun ${next.id} lagi.`,
      );
    }

    return {
      account: this.getActiveAccount(),
      login,
      message: `Aktif: *${next.label}* (${maskEmail(next.email)}) @ ${config.zeya.siteLabel}`,
    };
  }

  async verifyActiveIdentity() {
    try {
      const res = await this.client.get('/account/overview/', {
        maxRedirects: 5,
        headers: { Accept: 'text/html' },
      });
      const html = String(res.data || '');
      const url = String(res.request?.res?.responseUrl || res.config?.url || '');
      if (url.includes('/auth/login') || html.includes('id="wds_auth_form"')) {
        return { ok: false, found: '' };
      }

      const expected = String(this.account.email || '').toLowerCase();
      const found = extractLoggedInEmail(html);
      if (!found) {
        const pageOk =
          res.status === 200 &&
          (html.includes('/dashboard/invitation') || html.includes('account/overview'));
        return { ok: pageOk, found: '' };
      }

      return { ok: found === expected, found };
    } catch {
      return { ok: false, found: '' };
    }
  }

  async isLoggedIn() {
    if (!hasLoggedInCookie(this.jar)) {
      return false;
    }
    const identity = await this.verifyActiveIdentity();
    return identity.ok;
  }

  async ensureLogin({ force = false } = {}) {
    if (!force) {
      const ok = await this.isLoggedIn();
      if (ok) {
        return {
          success: true,
          reused: true,
          message: `Session aktif — ${config.zeya.siteLabel} / ${this.account.label} (${maskEmail(this.account.email)})`,
          account: this.getActiveAccount(),
          site: this.getActiveSite(),
        };
      }
    }

    return this.login();
  }

  async login() {
    const { email, password, label } = this.account;
    if (!email || !password) {
      throw new Error(`Email/password kosong untuk akun ${label}`);
    }

    this.jar = new CookieJar();
    this.client = createClient(this.jar);

    const loginPage = await this.client.get('/auth/login/', {
      headers: { Accept: 'text/html' },
    });
    const html = String(loginPage.data || '');
    const nonce = extractNonce(html);
    if (!nonce) {
      throw new Error('Gagal ambil nonce login dari /auth/login/');
    }

    const api = config.zeya.api;
    let data;

    if (api === 'wds') {
      data = await this.loginWds(email, password, nonce);
    } else {
      data = await this.loginLegacy(email, password, nonce);
      // fallback jika site sudah upgrade ke WDS
      if (!data?.success) {
        data = await this.loginWds(email, password, nonce);
      }
    }

    if (!data?.success) {
      const message = data?.message || data?.data || JSON.stringify(data);
      throw new Error(
        `Login gagal (${config.zeya.siteLabel} / ${label} / ${maskEmail(email)}): ${message}`,
      );
    }

    this.persist();
    writeActiveAccountId(this.account.id);

    const msg =
      (typeof data.message === 'string' && data.message) ||
      (typeof data.data === 'string' && data.data) ||
      `Login berhasil — ${label}`;

    return {
      success: true,
      reused: false,
      message: `${msg} @ ${config.zeya.siteLabel}`,
      account: this.getActiveAccount(),
      site: this.getActiveSite(),
    };
  }

  async loginLegacy(email, password, nonce) {
    const body = new URLSearchParams({
      email,
      password,
      rememberme: 'on',
      __nonce: nonce,
      _wp_http_referer: '/auth/login/',
      action: 'login_ajax_action',
    });

    const res = await this.client.post('/wp-admin/admin-ajax.php', body.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
        Referer: `${config.zeya.baseUrl}/auth/login/`,
      },
    });
    return res.data;
  }

  async loginWds(email, password, nonce) {
    const form = new FormData();
    form.append('email', email);
    form.append('password', password);
    form.append('rememberme', 'on');
    form.append('name', 'login');
    form.append('action', 'run_wds');
    form.append('__nonce', nonce);

    const res = await this.client.post('/wp-admin/admin-ajax.php', form, {
      headers: {
        ...form.getHeaders(),
        'X-Requested-With': 'XMLHttpRequest',
        Referer: `${config.zeya.baseUrl}/auth/login/`,
      },
    });
    return res.data;
  }

  getClient() {
    return this.client;
  }

  getJar() {
    return this.jar;
  }

  persist() {
    saveCookieJar(this.jar, this.cookieFile);
  }
}

export function extractNonceFromHtml(html) {
  return extractNonce(html);
}
