import { assertRuntimeConfig, config } from '../config.js';
import { ZeyaAuth } from '../zeya/auth.js';
import { ZeyaInvitation, buildGuestLink } from '../zeya/invitation.js';

async function run() {
  assertRuntimeConfig({ requireAdmins: false });

  console.log('== Smoke test zeyainvitation.com ==');
  console.log(`Base URL: ${config.zeya.baseUrl}`);
  console.log(`Email: ${config.zeya.email}`);

  const auth = new ZeyaAuth();
  const invitation = new ZeyaInvitation(auth);

  const login = await auth.ensureLogin({ force: true });
  console.log('Login:', login);

  const loggedIn = await auth.isLoggedIn();
  console.log('isLoggedIn:', loggedIn);
  if (!loggedIn) {
    throw new Error('Expected logged in session');
  }

  const categories = await invitation.listCategories();
  console.log('Categories:', categories);

  const categoryId = categories.find((c) => c.id === '156')?.id || categories[0]?.id;
  if (!categoryId) {
    throw new Error('No categories available');
  }

  const templates = await invitation.listTemplates(categoryId);
  console.log(`Templates for ${categoryId}:`, templates.slice(0, 5));
  console.log(`Template count: ${templates.length}`);
  if (!templates.length) {
    throw new Error('Expected templates list');
  }

  const sample = buildGuestLink('demo-slug', 'Andi Prasetyo');
  console.log('Sample guest link:', sample);

  const guestLinks = invitation.generateGuestLinks('aisyahalfi', [
    'Andi Prasetyo',
    'Budi Santoso',
  ]);
  console.log('Guest links:', guestLinks);

  // Create a real invitation only when CREATE_TEST=1
  if (process.env.CREATE_TEST === '1') {
    const slug = `bot-smoke-${Date.now().toString().slice(-8)}`;
    const template = templates[0];
    console.log('Creating test invitation...', { slug, template });
    const created = await invitation.createInvitation({
      title: `Bot Smoke ${slug}`,
      slug,
      categoryId,
      templateId: template.id,
      templateName: template.name,
      taxonomy: template.taxonomy || 'template-pernikahan',
    });
    console.log('Created:', created);
  } else {
    console.log('Skip create (set CREATE_TEST=1 to create a real invitation)');
  }

  console.log('Smoke test OK');
}

run().catch((err) => {
  console.error('Smoke test FAILED:', err);
  process.exit(1);
});
