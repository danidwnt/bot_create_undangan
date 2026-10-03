import fs from 'node:fs';
import { switchSite } from '../config.js';
import { ZeyaAuth } from '../zeya/auth.js';
import { ZeyaInvitationEditor } from '../zeya/edit.js';

switchSite('invmoment');
const auth = new ZeyaAuth();
await auth.ensureLogin({ force: true });
const editor = new ZeyaInvitationEditor(auth);
const postId = process.env.POST_ID || '32851';
const html = await editor.getEditPage(postId);
fs.writeFileSync('tmp-invmoment-edit-32851.html', html);
console.log('len', html.length);
console.log('auth form', html.includes('wds_auth_form'));
console.log('JetFormBuilderSettings', html.includes('JetFormBuilderSettings'));
console.log('data-form-id count', [...html.matchAll(/data-form-id=/gi)].length);
console.log('judul_undangan', html.includes('judul_undangan'));
console.log('form--audio', html.includes('form--audio'));
console.log('ajax_nonce', html.match(/["']ajax_nonce["']\s*:\s*["']([a-f0-9]+)["']/i)?.[1]);
console.log(
  'ajaxurl snippet',
  html.match(/JetFormBuilderSettings[\s\S]{0,200}/)?.[0]?.slice(0, 200),
);
const ctx = editor.useEditContext(html);
console.log('ctx', ctx);
