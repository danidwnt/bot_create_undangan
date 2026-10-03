import { assertRuntimeConfig, config } from '../config.js';
import { lalaEdoInvitation } from '../data/lala-edo.js';
import { ZeyaAuth } from '../zeya/auth.js';
import { ZeyaInvitationEditor } from '../zeya/edit.js';
import { ZeyaInvitation, buildInvitationLink } from '../zeya/invitation.js';

async function run() {
  assertRuntimeConfig({ requireAdmins: false });

  const data = { ...lalaEdoInvitation };
  if (process.env.INVITE_SLUG) {
    data.slug = process.env.INVITE_SLUG;
  }

  console.log('== Create & fill invitation ==');
  console.log(`Theme: ${data.themeName} (${data.templateId})`);
  console.log(`Title/Slug: ${data.title} / ${data.slug}`);

  const auth = new ZeyaAuth();
  const invitation = new ZeyaInvitation(auth);
  const editor = new ZeyaInvitationEditor(auth);

  await auth.ensureLogin({ force: true });

  let postId = process.env.POST_ID || '';
  if (!postId) {
    console.log('Creating invitation...');
    try {
      const created = await invitation.createInvitation({
        title: data.title,
        slug: data.slug,
        categoryId: data.categoryId,
        templateId: data.templateId,
        templateName: data.themeName,
        taxonomy: data.taxonomy,
      });
      console.log('Created:', created);
      postId = String(created.postId || '');
      if (!postId) {
        const found = await invitation.findInvitation(data.slug);
        postId = found?.postId || '';
      }
    } catch (err) {
      console.warn('Create gagal / slug mungkin sudah ada:', err.message);
      console.warn('Coba cari post_id existing dari dashboard, atau set POST_ID=...');
      throw err;
    }
  }

  if (!postId) {
    throw new Error('postId tidak ditemukan setelah create');
  }

  console.log('Filling forms for postId=', postId);
  const filled = await editor.fillInvitation(postId, data);
  console.log('Filled sections:', filled.sections);

  const link = buildInvitationLink(data.slug);
  console.log('Invitation link:', link);
  console.log('Edit link:', `${config.zeya.baseUrl}/dashboard/invitation/edit/?id=${postId}`);
  console.log('NOTE: Foto belum diupload — kirim via WhatsApp lalu upload manual / fitur upload berikutnya.');
  console.log('DONE');
}

run().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
