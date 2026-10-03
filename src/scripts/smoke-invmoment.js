import { switchSite, config } from '../config.js';
import { ZeyaAuth } from '../zeya/auth.js';
import { ZeyaInvitation } from '../zeya/invitation.js';
import { resolveTemplateByTheme } from '../zeya/resolve.js';

async function main() {
  const site = switchSite('invmoment');
  console.log('Switched to', site.id, site.baseUrl, site.api);
  console.log('config.baseUrl', config.zeya.baseUrl, config.zeya.api);

  const auth = new ZeyaAuth();
  const invitation = new ZeyaInvitation(auth);

  const login = await auth.ensureLogin({ force: true });
  console.log('login', login.message);

  const cats = await invitation.listCategories();
  console.log(
    'categories',
    cats.map((c) => `${c.id}:${c.name}`).join(', '),
  );

  const theme = await resolveTemplateByTheme(invitation, 'Premium 3', '44');
  console.log('theme Premium 3 =>', theme);
  if (!theme || !/premium/i.test(theme.name)) {
    throw new Error('Premium 3 tidak ketemu di InvMoment');
  }

  // balik ke zeya agar default aman
  switchSite('zeya');
  console.log('OK InvMoment smoke');
}

main().catch((err) => {
  console.error('FAILED', err);
  process.exit(1);
});
