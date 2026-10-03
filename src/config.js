import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(rootDir, '.env') });

function parseAdminNumbers(raw) {
  return String(raw || '')
    .split(',')
    .map((n) => n.replace(/\D/g, ''))
    .filter(Boolean)
    .map((n) => (n.startsWith('0') ? `62${n.slice(1)}` : n));
}

/**
 * Multi-akun website dari .env:
 *   ZEYA_EMAIL / ZEYA_PASSWORD / ZEYA_LABEL        → akun 1
 *   ZEYA_EMAIL_2 / ZEYA_PASSWORD_2 / ZEYA_LABEL_2 → akun 2
 */
function parseAccounts() {
  const accounts = [];

  const email1 = process.env.ZEYA_EMAIL?.trim() || '';
  const pass1 = process.env.ZEYA_PASSWORD?.trim() || '';
  if (email1 && pass1) {
    accounts.push({
      id: '1',
      label: process.env.ZEYA_LABEL?.trim() || 'Akun 1',
      email: email1,
      password: pass1,
    });
  }

  for (let i = 2; i <= 10; i += 1) {
    const email = process.env[`ZEYA_EMAIL_${i}`]?.trim() || '';
    const password = process.env[`ZEYA_PASSWORD_${i}`]?.trim() || '';
    if (!email || !password) continue;
    accounts.push({
      id: String(i),
      label: process.env[`ZEYA_LABEL_${i}`]?.trim() || `Akun ${i}`,
      email,
      password,
    });
  }

  return accounts;
}

/**
 * Multi-website:
 *   SITE_ZEYA_URL / SITE_ZEYA_LABEL / SITE_ZEYA_API=legacy
 *   SITE_INVMOMENT_URL / SITE_INVMOMENT_LABEL / SITE_INVMOMENT_API=wds
 *   ACTIVE_SITE=zeya|invmoment
 */
function parseSites() {
  const list = [];

  const zeyaUrl = (
    process.env.SITE_ZEYA_URL ||
    process.env.ZEYA_BASE_URL ||
    'https://zeyainvitation.com'
  ).replace(/\/$/, '');
  list.push({
    id: 'zeya',
    label: process.env.SITE_ZEYA_LABEL?.trim() || 'Zeya',
    baseUrl: zeyaUrl,
    api: (process.env.SITE_ZEYA_API || 'legacy').toLowerCase(),
    guestTutorialUrl:
      process.env.ZEYA_GUEST_TUTORIAL_URL?.trim() || 'https://bit.ly/4ey9T4W',
  });

  const invUrl = (
    process.env.SITE_INVMOMENT_URL ||
    process.env.INVMOMENT_BASE_URL ||
    'https://invmoment.my.id'
  ).replace(/\/$/, '');
  list.push({
    id: 'invmoment',
    label: process.env.SITE_INVMOMENT_LABEL?.trim() || 'InvMoment',
    baseUrl: invUrl,
    api: (process.env.SITE_INVMOMENT_API || 'wds').toLowerCase(),
    guestTutorialUrl:
      process.env.INVMOMENT_GUEST_TUTORIAL_URL?.trim() ||
      process.env.ZEYA_GUEST_TUTORIAL_URL?.trim() ||
      '',
  });

  return list;
}

const accounts = parseAccounts();
const sites = parseSites();

const sessionsRoot = path.join(rootDir, 'sessions');
const activeSitePath = path.join(sessionsRoot, 'active-site.json');

function readActiveSiteId() {
  try {
    if (process.env.ACTIVE_SITE?.trim()) {
      return process.env.ACTIVE_SITE.trim().toLowerCase();
    }
    if (!fs.existsSync(activeSitePath)) return sites[0]?.id || 'zeya';
    const data = JSON.parse(fs.readFileSync(activeSitePath, 'utf8'));
    return String(data?.id || sites[0]?.id || 'zeya').toLowerCase();
  } catch {
    return sites[0]?.id || 'zeya';
  }
}

function writeActiveSiteId(siteId) {
  fs.mkdirSync(path.dirname(activeSitePath), { recursive: true });
  fs.writeFileSync(
    activeSitePath,
    JSON.stringify({ id: String(siteId), updatedAt: new Date().toISOString() }, null, 2),
  );
}

function getSiteById(siteId) {
  const id = String(siteId || '').toLowerCase();
  return sites.find((s) => s.id === id) || null;
}

let activeSite = getSiteById(readActiveSiteId()) || sites[0];

export const config = {
  rootDir,
  sites,
  get site() {
    return activeSite;
  },
  zeya: {
    email: accounts[0]?.email || process.env.ZEYA_EMAIL?.trim() || '',
    password: accounts[0]?.password || process.env.ZEYA_PASSWORD?.trim() || '',
    get baseUrl() {
      return activeSite.baseUrl;
    },
    get api() {
      return activeSite.api;
    },
    get siteId() {
      return activeSite.id;
    },
    get siteLabel() {
      return activeSite.label;
    },
    get guestTutorialUrl() {
      return activeSite.guestTutorialUrl || '';
    },
    accounts,
  },
  adminNumbers: parseAdminNumbers(process.env.ADMIN_NUMBERS),
  logLevel: process.env.LOG_LEVEL || 'info',
  paths: {
    waSession: path.join(sessionsRoot, 'wa'),
    zeyaDir: path.join(sessionsRoot, 'zeya'),
    sessionsRoot,
    zeyaCookies: path.join(sessionsRoot, 'zeya', 'cookies.json'),
    zeyaActiveAccount: path.join(sessionsRoot, 'active-account.json'),
    activeSite: activeSitePath,
  },
};

export function getActiveSite() {
  return activeSite;
}

export function listSites() {
  return sites.map((s) => ({
    ...s,
    active: s.id === activeSite.id,
  }));
}

export function switchSite(query) {
  const q = String(query || '')
    .trim()
    .toLowerCase();
  if (!q) return null;
  const found =
    getSiteById(q) ||
    sites.find((s) => s.label.toLowerCase() === q) ||
    sites.find((s) => s.label.toLowerCase().includes(q)) ||
    sites.find((s) => s.baseUrl.toLowerCase().includes(q));
  if (!found) return null;
  activeSite = found;
  writeActiveSiteId(found.id);
  return found;
}

export function getZeyaAccountByQuery(query) {
  const q = String(query || '').trim();
  if (!q) return null;
  const list = config.zeya.accounts;
  const byId = list.find((a) => a.id === q);
  if (byId) return byId;
  const lower = q.toLowerCase();
  return (
    list.find((a) => a.label.toLowerCase() === lower) ||
    list.find((a) => a.label.toLowerCase().includes(lower)) ||
    list.find((a) => a.email.toLowerCase().includes(lower)) ||
    null
  );
}

export function cookiePathForAccount(accountId, siteId = activeSite.id) {
  const id = String(accountId || '1');
  const site = String(siteId || activeSite.id || 'zeya');
  return path.join(sessionsRoot, site, `cookies-${id}.json`);
}

export function assertRuntimeConfig({ requireAdmins = true } = {}) {
  if (!config.zeya.accounts.length) {
    throw new Error(
      'Belum ada akun website. Isi ZEYA_EMAIL + ZEYA_PASSWORD (dan opsional ZEYA_EMAIL_2) di .env',
    );
  }
  if (requireAdmins && config.adminNumbers.length === 0) {
    throw new Error('Set ADMIN_NUMBERS in .env (comma-separated WhatsApp numbers)');
  }
}
