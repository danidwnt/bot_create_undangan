import { switchSite, config } from '../config.js';
import { ZeyaAuth } from '../zeya/auth.js';
import { ZeyaInvitationEditor } from '../zeya/edit.js';

switchSite('invmoment');
console.log('site', config.zeya.baseUrl);

const auth = new ZeyaAuth();
await auth.ensureLogin({ force: true });
const editor = new ZeyaInvitationEditor(auth);
const postId = process.env.POST_ID || '32850';

const html = await editor.getEditPage(postId);
console.log('theme?', editor.isThemeSectionEditor(html));
const ctx = editor.useEditContext(html);
console.log('formIds', ctx.formIds);
console.log('ajaxUrl', ctx.ajaxUrl);

const result = await editor.submitForm(postId, ctx.formIds.meta, {
  _meta_judul: 'The Wedding Of Faqih & Dina',
});
console.log('meta submit', result?.status, String(result?.message || '').slice(0, 80));
