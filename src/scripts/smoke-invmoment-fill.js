import { switchSite, config } from '../config.js';
import { ZeyaAuth } from '../zeya/auth.js';
import { ZeyaInvitation } from '../zeya/invitation.js';
import { ZeyaInvitationEditor } from '../zeya/edit.js';
import { pickMusicUrl } from '../zeya/resolve.js';

switchSite('invmoment');
console.log('site', config.zeya.baseUrl, config.zeya.api);

const auth = new ZeyaAuth();
await auth.ensureLogin({ force: true });
const invitation = new ZeyaInvitation(auth);
const editor = new ZeyaInvitationEditor(auth);

let postId = process.env.POST_ID || '';
let slug = process.env.SLUG || '';
if (!postId) {
  const theme = (await invitation.listTemplates('44')).find((t) =>
    /premium\s*0?3/i.test(t.name),
  );
  slug = `smoke-im-${Date.now().toString().slice(-6)}`;
  const created = await invitation.createInvitation({
    title: 'Smoke InvMoment',
    slug,
    categoryId: theme?.categoryId || '44',
    templateId: theme?.id,
    templateName: theme?.name,
    taxonomy: theme?.taxonomy || 'wds_template_wedding',
  });
  postId = created.postId;
  slug = created.slug || slug;
  console.log('created', postId, slug);
}

const html = await editor.getEditPage(postId);
const ctx = editor.useEditContext(html);
console.log('formIds', ctx.formIds);
console.log('ajaxUrl', ctx.ajaxUrl);

const musicUrl = pickMusicUrl(html, 'Enchanted') || pickMusicUrl(html, 'Ari Lasso') || '';
console.log('music pick', musicUrl.slice(0, 100));

const result = await editor.fillInvitation(postId, {
  title: 'Smoke & Probe',
  slug: slug || `smoke-${postId}`,
  coverDateText: 'Sabtu, 10 Oktober 2026',
  coverDateTime: '2026-10-10T10:00',
  bride: {
    fullName: 'Dina Probe',
    nickname: 'Dina',
    parents: 'Bpk. Test & Ibu Test',
  },
  groom: {
    fullName: 'Faqih Probe',
    nickname: 'Faqih',
    parents: 'Bpk. Demo & Ibu Demo',
  },
  events: [
    {
      name: 'Akad',
      dateISO: '2026-10-10',
      time: '08:00',
      place: 'Masjid Probe',
      address: 'Jl. Probe No. 1',
    },
    {
      name: 'Resepsi',
      dateISO: '2026-10-10',
      time: '10:00',
      place: 'Gedung Probe',
      address: 'Jl. Probe No. 2',
    },
  ],
  accounts: [
    { owner: 'Faqih Probe', number: '1234567890', bank: 'BCA' },
  ],
  musicUrl,
  musicTitle: musicUrl ? 'Enchanted' : '',
});

console.log(JSON.stringify(result, null, 2));
