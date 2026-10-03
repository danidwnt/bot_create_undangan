import { isBotRunning, startBot, stopBot } from '../bot-state.js';
import { config, listSites } from '../config.js';
import { lalaEdoInvitation } from '../data/lala-edo.js';
import {
  formatGondonganSummary,
  parseGondongan,
} from '../parser/gondongan.js';
import { withCoupleFormSwap } from '../parser/couple.js';
import {
  formatLoveStorySummary,
  looksLikeLoveStory,
  parseLoveStories,
} from '../parser/love-story.js';
import { getMessageText, getReplyJid, getSenderNumber, isAdminNumber } from '../whatsapp/client.js';
import {
  resolveMusicByTitle,
  resolveTemplateByTheme,
} from '../zeya/resolve.js';
import {
  buildInvitationLink,
  parseGuestNames,
} from '../zeya/invitation.js';
import { formatDeliveryMessage } from '../zeya/delivery-message.js';

const HELP_TEXT = `*Bot Undangan (Zeya / InvMoment)*

Perintah:
• /start — aktifkan bot (wajib sebelum perintah lain)
• /stop — matikan bot (abaikan semua perintah)
• /ping — cek bot
• /help — bantuan
• /status — status session WA + website
• /site — daftar & pilih website (Zeya / InvMoment)
• /site <zeya|invmoment> — ganti website aktif
• /akun — daftar & pilih akun login website
• /akun <no|label> — ganti akun aktif
• /login — refresh login akun aktif
• /kategori — daftar categoryId
• /templates <categoryId> — daftar templateId
• /buat — buat undangan baru dari data gondongan
• /update <slug|postId> — update undangan existing
• /tukar — toggle tukar form (saat draft sebelum YA)
• /tukar <slug|postId> — langsung tukar form pria↔wanita (tanpa kirim data ulang)
• /ya — konfirmasi buat/update
• /batal — batalkan draft
• /buat-kosong Judul | slug | categoryId | templateId
• /isi-lala-edo — sample Lala & Edo
• /link slug | Nama1, Nama2
• /hasil <slug|postId> — pesan hasil undangan siap kirim ke customer
• /love-story <slug|postId> — update love story saja (terpisah)

*Pilih akun dulu (kalau ada lebih dari 1):*
1. /akun
2. /akun 2   (atau /akun NamaLabel)
3. Lanjut /buat atau /update

*Buat undangan:*
1. /buat
2. Paste data gondongan
3. Cek ringkasan, balas YA

*Update undangan:*
1. /update lala-edo
2. Paste data gondongan
3. Cek ringkasan, balas YA
4. Data diisi ulang, link tetap sama (foto/YouTube tidak diganti otomatis)

*Love story (terpisah):*
1. /love-story amel-richo
2. Paste teks love story (judul wajib (JUDUL))
3. Cek ringkasan, balas YA

*Template posisi terbalik:*
• /tukar slug — langsung tukar form yang sudah terisi
• Atau sebelum YA ketik /tukar
• Atau di gondongan: posisi template: terbalik

Catatan: foto & YouTube selalu manual. Paste data hanya setelah /buat atau /update.`;

export function createCommandHandler({ auth, invitation, editor, logger = console }) {
  const pendingLink = new Map();
  /** @type {Map<string, 'waitingData'|object>} */
  const pendingGondongan = new Map();
  /** @type {Map<string, {mode:'create'|'update', data:object, target?:object}>} */
  const pendingConfirm = new Map();
  /** @type {Map<string, {postId:string, slug:string, title?:string}>} */
  const pendingUpdateTarget = new Map();
  /** @type {Map<string, {postId:string, slug:string, title?:string}|'waitingData'>} */
  const pendingLoveStory = new Map();

  return async function handleMessage(sock, msg) {
    const text = getMessageText(msg);
    if (!text) return;
    // Abaikan pesan yang terlihat seperti balasan bot (hindari loop)
    if (/^- Hallo kak/im.test(text) || /^\*Ringkasan /im.test(text) || /^(✅|❌|⏳|🔄|✏️|📩|💕)/u.test(text)) {
      return;
    }

    const sender = getSenderNumber(msg, sock);
    const remoteJid = getReplyJid(msg);
    if (!remoteJid || remoteJid.endsWith('@g.us')) {
      return;
    }

    if (!isAdminNumber(sender)) {
      // Infokan sekali jika terlihat perintah, supaya admin 2 tidak "diam"
      if (text.startsWith('/') || /^(ya|y|ok|oke|yes|batal|status|help|bantuan)$/i.test(text.trim())) {
        logger.warn(
          `Diabaikan (bukan admin). sender=${sender || '(kosong)'} jid=${msg.key?.remoteJid || '-'} pn=${msg.key?.senderPn || msg.key?.participantPn || '-'}`,
        );
        try {
          await sock.sendMessage(remoteJid, {
            text: `❌ Nomor *${sender || 'tidak terdeteksi'}* belum terdaftar sebagai admin.\nAdmin: ${config.adminNumbers.join(', ')}`,
          }, { quoted: msg });
        } catch {
          // ignore
        }
      }
      return;
    }

    const reply = async (body) => {
      await sock.sendMessage(remoteJid, { text: body }, { quoted: msg });
    };

    const lower = text.toLowerCase().trim();
    const clearPending = () => {
      pendingConfirm.delete(sender);
      pendingGondongan.delete(sender);
      pendingUpdateTarget.delete(sender);
      pendingLoveStory.delete(sender);
      pendingLink.delete(sender);
    };

    // /start & /stop selalu diproses (meski bot off)
    if (lower === '/start' || lower === 'start') {
      startBot();
      await reply(
        [
          '✅ Bot *AKTIF*.',
          'Sekarang perintah lain bisa dijalankan.',
          '',
          'Ketik */help* untuk daftar perintah, */stop* untuk mematikan.',
        ].join('\n'),
      );
      return;
    }

    if (lower === '/stop' || lower === 'stop') {
      stopBot();
      clearPending();
      await reply(
        [
          '🛑 Bot *DIMATIKAN*.',
          'Semua perintah diabaikan sampai ada */start* lagi.',
          'Draft/pending juga dibersihkan.',
        ].join('\n'),
      );
      return;
    }

    if (!isBotRunning()) {
      // Diam untuk chat biasa; untuk perintah beri petunjuk singkat
      if (text.startsWith('/') || /^(help|bantuan|status|ping)$/i.test(lower)) {
        await reply('⏸️ Bot belum aktif. Ketik */start* dulu.');
      }
      return;
    }

    // Confirm / cancel
    if (pendingConfirm.has(sender) && isConfirm(lower)) {
      const draft = pendingConfirm.get(sender);
      pendingConfirm.delete(sender);
      pendingGondongan.delete(sender);
      pendingUpdateTarget.delete(sender);
      pendingLoveStory.delete(sender);
      if (draft.mode === 'love-story') {
        await processLoveStoryFill({
          stories: draft.stories,
          target: draft.target,
          reply,
          editor,
          logger,
        });
      } else if (draft.mode === 'update') {
        await processUpdateFill({
          data: draft.data,
          target: draft.target,
          reply,
          editor,
          logger,
        });
      } else {
        await processCreateFill({
          data: draft.data,
          reply,
          invitation,
          editor,
          logger,
        });
      }
      return;
    }

    if (
      (pendingConfirm.has(sender) ||
        pendingGondongan.has(sender) ||
        pendingUpdateTarget.has(sender) ||
        pendingLoveStory.has(sender)) &&
      isCancel(lower)
    ) {
      pendingConfirm.delete(sender);
      pendingGondongan.delete(sender);
      pendingUpdateTarget.delete(sender);
      pendingLoveStory.delete(sender);
      await reply('✅ Draft dibatalkan.');
      return;
    }

    // Waiting for love story paste
    if (pendingLoveStory.has(sender) && !text.startsWith('/')) {
      const target = pendingLoveStory.get(sender);
      if (target && target !== 'waitingData') {
        await handleLoveStoryParse({
          text,
          sender,
          reply,
          pendingConfirm,
          pendingLoveStory,
          target,
          logger,
        });
        return;
      }
    }

    // Waiting for gondongan paste (create or update)
    if (pendingGondongan.get(sender) === 'waitingData' && !text.startsWith('/')) {
      const updateTarget = pendingUpdateTarget.get(sender) || null;
      await handleGondonganParse({
        text,
        sender,
        reply,
        invitation,
        pendingConfirm,
        pendingGondongan,
        pendingUpdateTarget,
        updateTarget,
        logger,
      });
      return;
    }

    // Continue pending /link guest list
    if (pendingLink.has(sender) && !text.startsWith('/')) {
      const slug = pendingLink.get(sender);
      pendingLink.delete(sender);
      const names = parseGuestNames(text);
      if (!names.length) {
        await reply('Tidak ada nama tamu. Kirim lagi: /link slug');
        return;
      }
      const links = invitation.generateGuestLinks(slug, names);
      await reply(formatGuestLinks(slug, links));
      return;
    }

    // Auto-detect gondongan DIMATIKAN — harus /buat atau /update dulu
    // (mencegah bot ikut merespons ringkasan/reply sendiri)

    if (lower === '/ping') {
      await reply('pong');
      return;
    }

    if (lower === '/help' || lower === 'help' || lower === 'bantuan') {
      await reply(HELP_TEXT);
      return;
    }

    // Toggle tukar form saat draft sudah ada
    if (
      (lower === '/tukar' || lower === 'tukar') &&
      pendingConfirm.has(sender)
    ) {
      const draft = pendingConfirm.get(sender);
      draft.data = withCoupleFormSwap(draft.data);
      pendingConfirm.set(sender, draft);
      const summary = formatGondonganSummary(draft.data, {
        templateId: draft.mode === 'update' ? '(tetap)' : draft.data.templateId,
      });
      await reply(
        [
          draft.data.swapCoupleForms
            ? '🔄 Form mempelai *DITUKAR* (wanita↔pria) untuk template terbalik.'
            : '↩️ Form mempelai dikembalikan *normal*.',
          '',
          summary,
          '',
          'Balas *YA* untuk lanjut, */tukar* lagi untuk toggle, *BATAL* untuk batal.',
        ].join('\n'),
      );
      return;
    }

    if (lower.startsWith('/tukar')) {
      const arg = text.replace(/^\/tukar\s*/i, '').trim();
      if (!arg) {
        await reply(
          [
            'Format:',
            '/tukar — toggle tukar form (saat ada draft YA)',
            '/tukar <slug|postId> — langsung tukar form wanita↔pria',
            '',
            'Contoh: /tukar lala-edo',
          ].join('\n'),
        );
        return;
      }

      try {
        await reply(`⏳ Mencari undangan *${arg}*...`);
        const found = await invitation.findInvitation(arg);
        if (!found) {
          await reply(`❌ Undangan tidak ditemukan: ${arg}`);
          return;
        }

        await reply(
          `🔄 Menukar form mempelai di *${found.slug || arg}* (ID ${found.postId})...`,
        );
        const swapped = await editor.swapCoupleForms(found.postId);
        await reply(
          [
            '✅ Form mempelai berhasil ditukar',
            `Slug: ${found.slug || '-'}`,
            `Link: ${buildInvitationLink(found.slug || arg)}`,
            '',
            `Form wanita sekarang: ${swapped.after.wanita.fullName || '-'} (${swapped.after.wanita.nickname || '-'})`,
            `Form pria sekarang: ${swapped.after.pria.fullName || '-'} (${swapped.after.pria.nickname || '-'})`,
          ].join('\n'),
        );
      } catch (err) {
        logger.error(err);
        await reply(`❌ Gagal tukar form: ${err.message}`);
      }
      return;
    }

    if (lower.startsWith('/hasil') || lower.startsWith('/kirim')) {
      const arg = text.replace(/^\/(?:hasil|kirim)\s*/i, '').trim();
      if (!arg) {
        await reply('Format: /hasil <slug|postId>\nContoh: /hasil amel-richo');
        return;
      }

      try {
        await reply(`⏳ Menyiapkan pesan hasil untuk *${arg}*...`);
        const found = await invitation.findInvitation(arg);
        if (!found?.postId) {
          await reply(`❌ Undangan tidak ditemukan: ${arg}`);
          return;
        }

        const meta = editor
          ? await editor.getDeliveryMeta(found.postId, found.slug)
          : { postId: found.postId, slug: found.slug };

        await reply(
          formatDeliveryMessage({
            slug: meta.slug || found.slug,
            postId: meta.postId || found.postId,
          }),
        );
      } catch (err) {
        logger.error(err);
        await reply(`❌ Gagal buat pesan hasil: ${err.message}`);
      }
      return;
    }

    if (
      lower.startsWith('/love-story') ||
      lower.startsWith('/lovestory') ||
      lower.startsWith('/cerita')
    ) {
      const arg = text
        .replace(/^\/(?:love-story|lovestory|cerita)\s*/i, '')
        .trim();
      if (!arg) {
        await reply(
          [
            'Format: /love-story <slug|postId>',
            'Contoh: /love-story amel-richo',
            '',
            'Setelah itu paste teks love story (satu pesan), lalu YA.',
          ].join('\n'),
        );
        return;
      }

      try {
        await reply(`⏳ Mencari undangan *${arg}* untuk love story...`);
        const found = await invitation.findInvitation(arg);
        if (!found?.postId) {
          await reply(`❌ Undangan tidak ditemukan: ${arg}`);
          return;
        }

        pendingLoveStory.set(sender, found);
        pendingConfirm.delete(sender);
        pendingGondongan.delete(sender);
        pendingUpdateTarget.delete(sender);

        await reply(
          [
            '💕 Mode *UPDATE LOVE STORY*',
            `Post ID: ${found.postId}`,
            `Slug: ${found.slug || '-'}`,
            `Link: ${buildInvitationLink(found.slug || arg)}`,
            '',
            'Kirim teks love story sekarang (satu pesan).',
            'Setiap judul *wajib* diakhiri (JUDUL), contoh:',
            '2013 — Awal Sebuah Cerita (JUDUL)',
            'isi paragraf...',
            '',
            'Lamaran — Sebuah Janji (JUDUL)',
            'isi paragraf...',
            '',
            'Balas *BATAL* untuk membatalkan.',
          ].join('\n'),
        );
      } catch (err) {
        logger.error(err);
        await reply(`❌ Gagal: ${err.message}`);
      }
      return;
    }

    if (lower.startsWith('/update')) {
      const arg = text.replace(/^\/update\s*/i, '').trim();
      if (!arg) {
        await reply(
          [
            'Format:',
            '/update <slug>',
            '/update <postId>',
            '',
            'Contoh:',
            '/update lala-edo',
            '/update 136904',
          ].join('\n'),
        );
        return;
      }

      try {
        await reply(`⏳ Mencari undangan *${arg}*...`);
        const found = await invitation.findInvitation(arg);
        if (!found) {
          await reply(
            `❌ Undangan tidak ditemukan: ${arg}\nCek slug di dashboard atau pakai postId.`,
          );
          return;
        }

        pendingUpdateTarget.set(sender, found);
        pendingGondongan.set(sender, 'waitingData');
        pendingConfirm.delete(sender);
        pendingLoveStory.delete(sender);

        await reply(
          [
            '✏️ Mode *UPDATE* undangan',
            `Post ID: ${found.postId}`,
            `Slug: ${found.slug || '-'}`,
            found.title ? `Judul: ${found.title}` : null,
            `Link: ${buildInvitationLink(found.slug || arg)}`,
            '',
            'Kirim *data gondongan* sekarang (satu pesan).',
            'Slug/link tetap, data form akan diisi ulang.',
            'Tema/template tidak diganti.',
            '',
            'Balas *BATAL* untuk membatalkan.',
          ]
            .filter(Boolean)
            .join('\n'),
        );
      } catch (err) {
        logger.error(err);
        await reply(`❌ Gagal cari undangan: ${err.message}`);
      }
      return;
    }

    if (lower === '/buat' || lower === '/gondongan' || lower === '/data') {
      pendingGondongan.set(sender, 'waitingData');
      pendingConfirm.delete(sender);
      pendingUpdateTarget.delete(sender);
      pendingLoveStory.delete(sender);
      await reply(
        [
          '📩 Mode *BUAT BARU* — kirim data undangan gondongan sekarang (satu pesan).',
          '',
          'Minimal berisi:',
          '• Tema',
          '• Nama lengkap & panggilan wanita/pria',
          '• Akad / Resepsi',
          '• Amplop digital (opsional)',
          '• Judul lagu / YouTube (opsional)',
          '',
          'Setelah diparse, balas *YA* untuk membuat undangan.',
        ].join('\n'),
      );
      return;
    }

    if (lower === '/batal') {
      pendingConfirm.delete(sender);
      pendingGondongan.delete(sender);
      pendingUpdateTarget.delete(sender);
      pendingLink.delete(sender);
      await reply('✅ Dibatalkan.');
      return;
    }

    if (lower === '/ya' || lower === '/ok' || lower === '/proses') {
      if (!pendingConfirm.has(sender)) {
        await reply('Tidak ada draft. Kirim /buat atau /update dulu.');
        return;
      }
      const draft = pendingConfirm.get(sender);
      pendingConfirm.delete(sender);
      pendingGondongan.delete(sender);
      pendingUpdateTarget.delete(sender);
      if (draft.mode === 'update') {
        await processUpdateFill({
          data: draft.data,
          target: draft.target,
          reply,
          editor,
          logger,
        });
      } else {
        await processCreateFill({
          data: draft.data,
          reply,
          invitation,
          editor,
          logger,
        });
      }
      return;
    }

    if (lower === '/status') {
      let webStatus = 'belum dicek';
      const active = auth.getActiveAccount?.() || null;
      const site = auth.getActiveSite?.() || {};
      try {
        const loggedIn = await auth.isLoggedIn();
        webStatus = loggedIn ? 'login aktif' : 'belum login / expired';
      } catch (err) {
        webStatus = `error: ${err.message}`;
      }

      await reply(
        [
          '*Status Bot*',
          `Mode: ${isBotRunning() ? '✅ AKTIF (/stop untuk matikan)' : '⏸️ OFF (/start untuk aktifkan)'}`,
          `WhatsApp: connected`,
          `Website: *${site.label || config.zeya.siteLabel}* (${webStatus})`,
          `URL: ${config.zeya.baseUrl}`,
          `API: ${config.zeya.api}`,
          active
            ? `Akun aktif: ${active.id}. ${active.label} (${active.emailMasked})`
            : 'Akun aktif: -',
          `Admin: ${config.adminNumbers.join(', ') || '-'}`,
          '',
          'Ganti website: /site',
          'Ganti akun: /akun',
        ].join('\n'),
      );
      return;
    }

    if (lower === '/site' || lower.startsWith('/site ') || lower.startsWith('/web ')) {
      const arg = text.replace(/^\/(site|web)\s*/i, '').trim();
      try {
        if (!arg) {
          const lines = listSites().map(
            (s) =>
              `${s.active ? '→' : ' '} *${s.id}* — ${s.label}\n   ${s.baseUrl} (${s.api})`,
          );
          await reply(
            [
              '*Website*',
              ...lines,
              '',
              'Ganti:',
              '/site zeya',
              '/site invmoment',
            ].join('\n'),
          );
          return;
        }

        await reply(`⏳ Pindah ke website *${arg}*...`);
        const result = await auth.switchSite(arg);
        await reply(`✅ ${result.message}`);
      } catch (err) {
        logger.error(err);
        await reply(`❌ ${err.message}`);
      }
      return;
    }

    if (lower === '/akun' || lower.startsWith('/akun ')) {
      const arg = text.replace(/^\/akun\s*/i, '').trim();
      try {
        if (!arg) {
          const list = auth.listAccounts();
          const lines = list.map(
            (a) =>
              `${a.active ? '👉' : '•'} ${a.id}. ${a.label} — ${a.emailMasked}${a.active ? ' *(aktif)*' : ''}`,
          );
          await reply(
            [
              `*Akun Website — ${config.zeya.siteLabel}*`,
              ...lines,
              '',
              'Pilih akun:',
              '/akun 1',
              '/akun 2',
              'atau /akun NamaLabel',
            ].join('\n'),
          );
          return;
        }

        await reply(`⏳ Mengganti akun ke *${arg}* (login ulang)...`);
        const result = await auth.switchAccount(arg);
        await reply(
          [
            `✅ ${result.message}`,
            '',
            'Undangan berikutnya akan memakai akun ini.',
            'Cek: /status',
          ].join('\n'),
        );
      } catch (err) {
        logger.error(err);
        await reply(`❌ ${err.message}`);
      }
      return;
    }

    if (lower === '/login') {
      try {
        const active = auth.getActiveAccount?.();
        await reply(
          active
            ? `⏳ Login ulang *${active.label}*...`
            : '⏳ Login ulang website...',
        );
        const result = await auth.ensureLogin({ force: true });
        await reply(`✅ ${result.message}`);
      } catch (err) {
        await reply(`❌ Login gagal: ${err.message}`);
      }
      return;
    }

    if (lower === '/kategori' || lower === '/categories') {
      try {
        const categories = await invitation.listCategories();
        if (!categories.length) {
          await reply('Kategori kosong / gagal dimuat.');
          return;
        }
        const lines = categories.map((c) => `• ${c.id} — ${c.name}`);
        await reply(['*Kategori Undangan*', ...lines].join('\n'));
      } catch (err) {
        await reply(`❌ Gagal ambil kategori: ${err.message}`);
      }
      return;
    }

    if (lower.startsWith('/templates')) {
      const categoryId = text.split(/\s+/)[1];
      if (!categoryId) {
        await reply('Format: /templates <categoryId>\nContoh: /templates 70');
        return;
      }
      try {
        const templates = await invitation.listTemplates(categoryId);
        if (!templates.length) {
          await reply(
            `Template untuk kategori ${categoryId} tidak ditemukan.\nCoba cek di dashboard web lalu salin templateId-nya.`,
          );
          return;
        }
        const lines = templates.slice(0, 40).map((t) => {
          const tax = t.taxonomy ? ` [${t.taxonomy}]` : '';
          return `• ${t.id} — ${t.name}${tax}`;
        });
        const extra =
          templates.length > 40 ? `\n…dan ${templates.length - 40} template lainnya` : '';
        await reply([`*Template kategori ${categoryId}*`, ...lines].join('\n') + extra);
      } catch (err) {
        await reply(`❌ Gagal ambil template: ${err.message}`);
      }
      return;
    }

    if (lower.startsWith('/isi-lala-edo') || lower.startsWith('/buat-lala-edo')) {
      if (!editor) {
        await reply('❌ Modul editor belum tersedia.');
        return;
      }

      const maybePostId = text.split(/\s+/)[1];
      const data = { ...lalaEdoInvitation };
      try {
        await reply('⏳ Memproses undangan Lala & Edo (Haritage Palembang)...');
        let postId = maybePostId && /^\d+$/.test(maybePostId) ? maybePostId : '';

        if (!postId) {
          try {
            const created = await invitation.createInvitation({
              title: data.title,
              slug: data.slug,
              categoryId: data.categoryId,
              templateId: data.templateId,
              templateName: data.themeName,
              taxonomy: data.taxonomy,
            });
            postId = String(created.postId || '');
            if (!postId) {
              const found = await invitation.findInvitation(data.slug);
              postId = found?.postId || '';
            }
            if (!postId) {
              throw new Error(
                `Create sukses tapi postId tidak ditemukan. Coba: /update ${data.slug}`,
              );
            }
          } catch (err) {
            await reply(
              `⚠️ Create gagal (${err.message}).\nJika slug sudah ada, kirim: /isi-lala-edo <postId>`,
            );
            return;
          }
        }

        const filled = await editor.fillInvitation(postId, data);
        await reply(
          [
            '✅ Undangan Lala & Edo siap (teks + rekening + musik + acara)',
            `Tema: ${data.themeName}`,
            `Link: ${buildInvitationLink(data.slug)}`,
            `Edit: ${config.zeya.baseUrl}/dashboard/invitation/edit/?id=${postId}`,
            `Section: ${filled.sections.join(', ')}`,
            '',
            '📸 Foto belum diupload — kirim maks. 12 foto via WhatsApp (format WA HD).',
          ].join('\n'),
        );
      } catch (err) {
        logger.error(err);
        await reply(`❌ ${err.message}`);
      }
      return;
    }

    if (lower.startsWith('/buat-kosong')) {
      const payload = text.replace(/^\/buat-kosong\s*/i, '');
      const parts = payload.split('|').map((p) => p.trim());
      if (parts.length < 4) {
        await reply(
          'Format:\n/buat-kosong Judul | slug | categoryId | templateId\n\nContoh:\n/buat-kosong Putri dan Putra | putri-dan-putra | 70 | 12345',
        );
        return;
      }

      const [title, slug, categoryId, templateId, taxonomy = ''] = parts;
      try {
        await reply('⏳ Membuat undangan...');
        const result = await invitation.createInvitation({
          title,
          slug,
          categoryId,
          templateId,
          taxonomy,
        });
        await reply(
          [
            '✅ Undangan berhasil dibuat',
            `Judul: ${title}`,
            `Slug: ${slug}`,
            `Link: ${result.link}`,
            '',
            'Lanjut generate link tamu:',
            `/link ${slug}`,
          ].join('\n'),
        );
      } catch (err) {
        logger.error(err);
        await reply(`❌ ${err.message}`);
      }
      return;
    }

    if (lower.startsWith('/buat ')) {
      await reply(
        [
          'Untuk buat dari data gondongan, kirim hanya:',
          '/buat',
          '',
          'Lalu paste data gondongan.',
          '',
          'Untuk buat undangan kosong:',
          '/buat-kosong Judul | slug | categoryId | templateId',
        ].join('\n'),
      );
      return;
    }

    if (lower.startsWith('/link')) {
      const payload = text.replace(/^\/link\s*/i, '').trim();
      if (!payload) {
        await reply('Format:\n/link slug\nNama1\nNama2\n\natau\n/link slug | Nama1, Nama2');
        return;
      }

      let slug = payload;
      let namesRaw = '';

      if (payload.includes('|')) {
        const [s, ...rest] = payload.split('|');
        slug = s.trim();
        namesRaw = rest.join('|').trim();
      } else {
        const lines = payload.split('\n').map((l) => l.trim()).filter(Boolean);
        slug = lines[0];
        namesRaw = lines.slice(1).join('\n');
      }

      slug = slug.replace(/^\/+|\/+$/g, '');
      if (!slug) {
        await reply('Slug undangan wajib diisi.');
        return;
      }

      if (!namesRaw) {
        pendingLink.set(sender, slug);
        await reply(
          `Kirim daftar nama tamu untuk *${slug}* (satu baris satu nama, atau pisah koma).\nBase: ${buildInvitationLink(slug)}`,
        );
        return;
      }

      const names = parseGuestNames(namesRaw);
      if (!names.length) {
        await reply('Tidak ada nama tamu.');
        return;
      }

      const links = invitation.generateGuestLinks(slug, names);
      await reply(formatGuestLinks(slug, links));
      return;
    }
  };
}

async function handleGondonganParse({
  text,
  sender,
  reply,
  invitation,
  pendingConfirm,
  pendingGondongan,
  pendingUpdateTarget,
  updateTarget,
  logger,
}) {
  try {
    const { data, errors, warnings } = parseGondongan(text);
    if (errors.length) {
      pendingGondongan.set(sender, 'waitingData');
      await reply(
        [
          '❌ Data gondongan belum lengkap:',
          ...errors.map((e) => `• ${e}`),
          '',
          'Perbaiki lalu kirim ulang, atau /batal',
        ].join('\n'),
      );
      return;
    }

    const isUpdate = Boolean(updateTarget?.postId);

    if (isUpdate) {
      // Keep existing slug/link; title from new data is OK
      data.slug = updateTarget.slug || data.slug;
      // Theme/template not changed on update
      data.templateId = data.templateId || 'update-keep';
      data.themeName = data.themeName || '(tema existing)';
    } else {
      let template = null;
      if (data.themeName) {
        template = await resolveTemplateByTheme(invitation, data.themeName, data.categoryId);
        if (template) {
          data.templateId = String(template.id);
          data.themeName = template.name || data.themeName;
          data.categoryId = String(template.categoryId || data.categoryId || '156');
          data.taxonomy = template.taxonomy || data.taxonomy;
        }
      }

      if (!data.templateId) {
        pendingGondongan.set(sender, 'waitingData');
        await reply(
          [
            `❌ Tema "${data.themeName || '-'}" tidak ditemukan di katalog.`,
            'Cek nama tema (contoh: Haritage Palembang), atau /templates 156',
            'Lalu kirim ulang data / gondongan.',
          ].join('\n'),
        );
        return;
      }
    }

    pendingConfirm.set(sender, {
      mode: isUpdate ? 'update' : 'create',
      data,
      target: updateTarget || null,
    });
    pendingGondongan.delete(sender);
    if (!isUpdate) pendingUpdateTarget.delete(sender);

    const summary = formatGondonganSummary(data, {
      templateId: isUpdate ? '(tetap)' : data.templateId,
    });
    const warnText = warnings.length
      ? `\n\n⚠️ Peringatan:\n${warnings.map((w) => `• ${w}`).join('\n')}`
      : '';

    await reply(
      [
        isUpdate ? '*Mode UPDATE*' : '*Mode BUAT BARU*',
        isUpdate
          ? `Target: ${updateTarget.slug || '-'} (ID ${updateTarget.postId})`
          : null,
        summary,
        warnText,
        '',
        isUpdate
          ? 'Balas *YA* untuk update data undangan (link tetap).'
          : 'Balas *YA* untuk buat + isi undangan.',
        'Balas */tukar* jika posisi nama di template terbalik.',
        'Balas *BATAL* untuk membatalkan.',
      ]
        .filter((x) => x !== null)
        .join('\n'),
    );
  } catch (err) {
    logger.error(err);
    await reply(`❌ Gagal parse data: ${err.message}`);
  }
}

async function handleLoveStoryParse({
  text,
  sender,
  reply,
  pendingConfirm,
  pendingLoveStory,
  target,
  logger,
}) {
  try {
    const stories = parseLoveStories(text);
    if (!stories.length) {
      pendingLoveStory.set(sender, target);
      await reply(
        [
          '❌ Love story belum terdeteksi.',
          'Setiap judul *wajib* diakhiri (JUDUL), contoh:',
          '2013 — Awal Sebuah Cerita (JUDUL)',
          'isi paragraf...',
          '',
          'Kirim ulang teks, atau /batal',
        ].join('\n'),
      );
      return;
    }

    pendingConfirm.set(sender, {
      mode: 'love-story',
      stories,
      target,
    });
    pendingLoveStory.delete(sender);

    await reply(
      [
        formatLoveStorySummary(stories, {
          slug: target.slug,
          postId: target.postId,
        }),
        '',
        'Balas *YA* untuk update love story saja.',
        'Balas *BATAL* untuk membatalkan.',
      ].join('\n'),
    );
  } catch (err) {
    logger.error(err);
    await reply(`❌ Gagal parse love story: ${err.message}`);
  }
}

async function processLoveStoryFill({ stories, target, reply, editor, logger }) {
  if (!editor) {
    await reply('❌ Modul editor belum tersedia.');
    return;
  }
  if (!target?.postId) {
    await reply('❌ Target undangan tidak valid.');
    return;
  }

  try {
    const postId = String(target.postId);
    const slug = target.slug || '-';
    await reply(`⏳ Update love story *${slug}*...`);
    await editor.fillLoveStories(postId, stories);
    await reply(
      [
        '✅ Love story berhasil di-update',
        `Slug: ${slug}`,
        `Post ID: ${postId}`,
        `Cerita: ${stories.length}`,
        ...stories.map((s, i) => `${i + 1}. ${s.title}`),
        `Link: ${buildInvitationLink(slug)}`,
      ].join('\n'),
    );
  } catch (err) {
    logger.error(err);
    await reply(`❌ Gagal update love story: ${err.message}`);
  }
}

async function processUpdateFill({ data, target, reply, editor, logger }) {
  if (!editor) {
    await reply('❌ Modul editor belum tersedia.');
    return;
  }
  if (!target?.postId) {
    await reply('❌ Target update tidak valid.');
    return;
  }

  try {
    const auth = editor.auth;
    if (auth?.ensureLogin) {
      const login = await auth.ensureLogin();
      const active = auth.getActiveAccount?.();
      if (active) {
        await reply(
          `🔐 Memakai akun: *${active.label}* (${active.emailMasked})\n${login.message}`,
        );
      }
    }

    const postId = String(target.postId);
    const slug = target.slug || data.slug;
    data.slug = slug;

    await reply(`⏳ Update undangan *${slug || postId}*...`);

    if (data.musicTitle && !data.musicUrl) {
      try {
        data.musicUrl = await resolveMusicByTitle(editor, postId, data.musicTitle);
      } catch (err) {
        logger.warn('resolve music failed:', err.message);
      }
    }

    await reply('⏳ Mengisi ulang data form...');
    const filled = await editor.fillInvitation(postId, data);

    await reply(
      formatDeliveryMessage({
        slug,
        postId,
      }),
    );

    await reply(
      formatFillResultMessage({
        kind: 'update',
        data,
        postId,
        filled,
      }),
    );
  } catch (err) {
    logger.error(err);
    await reply(`❌ Gagal update undangan: ${err.message}`);
  }
}

async function processCreateFill({ data, reply, invitation, editor, logger }) {
  if (!editor) {
    await reply('❌ Modul editor belum tersedia.');
    return;
  }

  try {
    // Pastikan session sesuai akun aktif (bukan ketukar)
    const auth = editor.auth;
    if (auth?.ensureLogin) {
      const login = await auth.ensureLogin();
      const active = auth.getActiveAccount?.();
      if (active) {
        await reply(
          `🔐 Memakai akun: *${active.label}* (${active.emailMasked})\n${login.message}`,
        );
      }
    }

    await reply(`⏳ Membuat undangan *${data.title}* (tema ${data.themeName})...`);

    let created;
    try {
      created = await invitation.createInvitation({
        title: data.title,
        slug: data.slug,
        categoryId: data.categoryId,
        templateId: data.templateId,
        templateName: data.themeName,
        taxonomy: data.taxonomy,
      });
    } catch (err) {
      if (/sudah|exist|dipakai|slug|duplicate|uniq/i.test(err.message)) {
        const altSlug = `${data.slug}-${Date.now().toString().slice(-5)}`;
        await reply(`⚠️ Slug bentrok, coba slug baru: ${altSlug}`);
        created = await invitation.createInvitation({
          title: data.title,
          slug: altSlug,
          categoryId: data.categoryId,
          templateId: data.templateId,
          templateName: data.themeName,
          taxonomy: data.taxonomy,
        });
        data.slug = altSlug;
      } else {
        throw err;
      }
    }

    let postId = String(created.postId || '');
    if (!postId) {
      const found = await invitation.findInvitation(data.slug);
      postId = found?.postId || '';
    }
    if (!postId) {
      throw new Error(
        `Create sukses tapi postId tidak ditemukan. Coba: /update ${data.slug}`,
      );
    }

    if (data.musicTitle && !data.musicUrl) {
      try {
        data.musicUrl = await resolveMusicByTitle(editor, postId, data.musicTitle);
      } catch (err) {
        logger.warn('resolve music failed:', err.message);
      }
    }

    await reply('⏳ Mengisi data form (mempelai, acara, rekening, musik)...');
    const filled = await editor.fillInvitation(postId, data);

    await reply(
      formatDeliveryMessage({
        slug: data.slug,
        postId,
      }),
    );

    await reply(
      formatFillResultMessage({
        kind: 'buat',
        data,
        postId,
        filled,
      }),
    );
  } catch (err) {
    logger.error(err);
    await reply(`❌ Gagal proses gondongan: ${err.message}`);
  }
}

function isConfirm(lower) {
  return ['ya', 'y', 'ok', 'oke', 'yes', '/ya', '/ok', '/proses', 'lanjut', 'proses'].includes(
    lower,
  );
}

function isCancel(lower) {
  return ['batal', 'cancel', 'no', 'tidak', '/batal', 'batalkan'].includes(lower);
}

function formatGuestLinks(slug, links) {
  const lines = links.map((item, i) => `${i + 1}. ${item.name}\n${item.link}`);
  return [`*Link tamu: ${slug}*`, `Total: ${links.length}`, '', ...lines].join('\n');
}

function formatFillResultMessage({ kind, data, postId, filled }) {
  const warnings = [
    ...(filled?.warnings || []),
    // info tetap (bukan error proses, tapi perlu diingat)
  ];

  const lines = [
    kind === 'buat' ? '✅ Buat undangan selesai (internal)' : '✅ Update selesai (internal)',
    `Judul: ${data.title || '-'}`,
    kind === 'buat' ? `Tema: ${data.themeName || '-'}` : null,
    `Cover: ${data.coverDateText || '-'}`,
    `Countdown: ${data.coverDateTime || '-'}`,
    data.musicUrl
      ? `Musik: ${data.musicTitle}`
      : data.musicTitle
        ? `Musik: belum — "${data.musicTitle}"`
        : 'Musik: -',
    `Section OK: ${(filled?.sections || []).join(', ') || '-'}`,
    `Edit: ${config.zeya.baseUrl}/dashboard/invitation/edit/?id=${postId}`,
    kind === 'buat'
      ? '📸 Foto belum diupload — kirim via WhatsApp (maks 12, format WA HD).'
      : null,
    `Link tamu per nama: /link ${data.slug || ''}`,
  ].filter((v) => v != null);

  if (warnings.length) {
    lines.push('', '⚠️ *Gagal / perlu isi manual:*');
    for (const w of warnings) {
      lines.push(`• ${w}`);
    }
  }

  return lines.join('\n');
}
