import FormData from 'form-data';
import { switchSite, config } from '../config.js';
import { ZeyaAuth } from '../zeya/auth.js';

switchSite('invmoment');

const auth = new ZeyaAuth();
await auth.ensureLogin({ force: true });
const client = auth.getClient();
const postId = process.env.POST_ID || '32850';

const res = await client.get(`/dashboard/invitation/edit/?id=${postId}`, {
  headers: { Accept: 'text/html' },
});
const html = String(res.data || '');

function extractJsonAssign(source, varName) {
  const start = source.search(new RegExp(`(?:var\\s+)?${varName}\\s*=\\s*\\{`));
  if (start < 0) return null;
  const brace = source.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(source.slice(brace, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

const settings = extractJsonAssign(html, 'JetFormBuilderSettings');
console.log('JetForm ajaxurl', settings?.ajaxurl);
console.log('gfb', settings?.gfb_request_args_key, settings?.gfb_request_args_value);

const wdsObj = extractJsonAssign(html, 'WDS');
const ajaxNonce =
  wdsObj?.ajax_nonce ||
  html.match(/["']ajax_nonce["']\s*:\s*["']([a-f0-9]+)["']/i)?.[1] ||
  '';
console.log('WDS.ajax_nonce', ajaxNonce);

// Music options / nonce patterns in page + linked JS mention
console.log(
  'music markers',
  {
    wds_form_edit_music: html.includes('wds_form_edit_music'),
    data_music: html.includes('data-music'),
    select_music: /name=["'][^"']*music/i.test(html),
    audio: html.includes('audio'),
    WDS_ajax_nonce: !!ajaxNonce,
  },
);

// Find music select options sample
const musicOpts = [
  ...html.matchAll(
    /<option[^>]*value=["']([^"']+)["'][^>]*data-music=["']([^"']+)["'][^>]*>([\s\S]*?)<\/option>/gi,
  ),
].slice(0, 3);
console.log(
  'music options',
  musicOpts.map((m) => ({
    value: m[1].slice(0, 80),
    music: m[2].slice(0, 80),
    label: m[3].replace(/<[^>]+>/g, '').trim().slice(0, 40),
  })),
);

// Fetch wds-dashboard.js snippet for music
const jsRes = await client.get(
  '/wp-content/plugins/weddingsaas-pro/assets/js/wds-dashboard.js?v=2.9.2',
  { headers: { Accept: '*/*' }, validateStatus: () => true },
);
const js = String(jsRes.data || '');
const musicIdx = js.search(/edit_music|form_edit_music|setMusic|music/i);
console.log('wds-dashboard.js len', js.length, 'musicIdx', musicIdx);
if (musicIdx >= 0) {
  console.log('--- music js context ---');
  console.log(js.slice(Math.max(0, musicIdx - 200), musicIdx + 800));
}

const wdsJs = await client.get('/wp-content/plugins/weddingsaas-pro/assets/js/wds.js?v=2.9.2', {
  headers: { Accept: '*/*' },
  validateStatus: () => true,
});
const wdsBody = String(wdsJs.data || '');
for (const pat of ['wds_form_edit_music', 'edit_music', 'ajax_nonce', 'formData.append']) {
  const i = wdsBody.indexOf(pat);
  console.log('wds.js', pat, i);
  if (i >= 0) console.log(wdsBody.slice(i - 100, i + 400));
}

async function trySubmit(label, url, formId, fields) {
  const form = new FormData();
  form.append('_jfb_current_render_states[]', 'DEFAULT.STATE');
  form.append('_jet_engine_booking_form_id', String(formId));
  form.append(
    '_jet_engine_refer',
    `${config.zeya.baseUrl}/dashboard/invitation/edit/?id=${postId}`,
  );
  form.append('__queried_post_id', String(postId));
  form.append('post_id', String(postId));
  for (const [k, v] of Object.entries(fields)) form.append(k, String(v));

  try {
    const r = await client.post(url, form, {
      headers: {
        ...form.getHeaders(),
        'X-Requested-With': 'XMLHttpRequest',
        Accept: 'application/json, text/javascript, */*; q=0.01',
        Referer: `${config.zeya.baseUrl}/dashboard/invitation/edit/?id=${postId}`,
      },
      validateStatus: () => true,
      maxBodyLength: Infinity,
      timeout: 60000,
    });
    const body =
      typeof r.data === 'string'
        ? r.data.slice(0, 220).replace(/\s+/g, ' ')
        : JSON.stringify(r.data).slice(0, 300);
    console.log(`\n[${label}] ${r.status}`, body);
    return r.data;
  } catch (err) {
    console.log(`\n[${label}] ERR`, err.code || err.message);
    return null;
  }
}

const ajaxPath = settings?.ajaxurl
  ? settings.ajaxurl.replace(config.zeya.baseUrl, '')
  : `/dashboard/invitation/edit/?${settings?.gfb_request_args_key}=${settings?.gfb_request_args_value}&method=ajax`;

console.log('\nUsing ajax path', ajaxPath);

// Minimal judul submit — only change language-safe field? Use existing slug
const slug =
  html.match(/name=["']_slug["'][^>]*value=["']([^"']*)["']/i)?.[1] ||
  html.match(/value=["']([^"']*)["'][^>]*name=["']_slug["']/i)?.[1] ||
  'faqih-dina';
const judul =
  html.match(/name=["']judul_undangan["'][^>]*value=["']([^"']*)["']/i)?.[1] ||
  html.match(/value=["']([^"']*)["'][^>]*name=["']judul_undangan["']/i)?.[1] ||
  'Faqih & Dina';

await trySubmit('judul-jfb-ajax', ajaxPath, '11464', {
  judul_undangan: judul,
  _slug: slug,
});

await trySubmit('meta-jfb-ajax', ajaxPath, '388', {
  _meta_judul: `The Wedding Of ${judul}`,
});

// Music with WDS.ajax_nonce
if (ajaxNonce && musicOpts[0]) {
  const body = new URLSearchParams({
    action: 'wds_form_edit_music',
    post_id: String(postId),
    selected: musicOpts[0][2] || musicOpts[0][1],
    nonce: ajaxNonce,
  });
  const mr = await client.post('/wp-admin/admin-ajax.php', body.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest',
      Referer: `${config.zeya.baseUrl}/dashboard/invitation/edit/?id=${postId}`,
    },
    validateStatus: () => true,
  });
  console.log(
    '\n[music]',
    mr.status,
    typeof mr.data === 'string' ? mr.data.slice(0, 200) : JSON.stringify(mr.data).slice(0, 250),
  );
}
