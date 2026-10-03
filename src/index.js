import { assertRuntimeConfig, config } from './config.js';
import { createCommandHandler } from './commands/handler.js';
import { startWhatsApp } from './whatsapp/client.js';
import { ZeyaAuth } from './zeya/auth.js';
import { ZeyaInvitationEditor } from './zeya/edit.js';
import { ZeyaInvitation } from './zeya/invitation.js';

async function main() {
  assertRuntimeConfig({ requireAdmins: true });

  console.log('Starting bot-create-undangan...');
  console.log(`Website aktif: ${config.zeya.siteLabel} (${config.zeya.baseUrl}) api=${config.zeya.api}`);
  console.log(
    `Sites: ${config.sites.map((s) => `${s.id}:${s.label}`).join(', ')}`,
  );
  console.log(`Admins: ${config.adminNumbers.join(', ')}`);
  console.log(
    `Akun: ${config.zeya.accounts.map((a) => `${a.id}:${a.label}`).join(', ')}`,
  );

  const auth = new ZeyaAuth();
  const invitation = new ZeyaInvitation(auth);
  const editor = new ZeyaInvitationEditor(auth);

  try {
    const login = await auth.ensureLogin();
    const active = auth.getActiveAccount();
    console.log(`Zeya: ${login.message}`);
    console.log(`Akun aktif: ${active.id}. ${active.label} (${active.emailMasked})`);
  } catch (err) {
    console.warn(`Zeya login awal gagal: ${err.message}`);
    console.warn('Bot tetap jalan. Kirim /akun atau /login setelah session siap.');
  }

  const onMessage = createCommandHandler({
    auth,
    invitation,
    editor,
    logger: console,
  });
  await startWhatsApp({ onMessage, logger: console });
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
