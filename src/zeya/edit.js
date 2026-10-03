import FormData from 'form-data';
import { config } from '../config.js';
import { getReligionTexts } from '../data/religion-texts.js';
import { formatAddress, formatCoverDate } from '../parser/format.js';
import { resolveCoupleFormSlots } from '../parser/couple.js';

/** Fallback form IDs (Zeya / WeddingSaas legacy). InvMoment & others discovered from edit HTML. */
const DEFAULT_FORM_IDS = {
  judul: '10608',
  meta: '10616',
  wanita: '10685',
  pria: '10686',
  acara: '10603',
  acara3: '11733',
  rekening: '10687',
  love: '10613',
  religion: '87189',
};

const DEFAULT_JETFORM_AJAX =
  '/dashboard/invitation/edit/?n1Z55l=T0Z21s89r7Yt&method=ajax';

/** Tiny PNG for WDS theme setting_form (server rejects empty thumbnail). */
const PLACEHOLDER_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5W2fQAAAAASUVORK5CYII=',
  'base64',
);

/**
 * Fill Jet Form Builder sections + music on invitation edit page.
 */
export class ZeyaInvitationEditor {
  constructor(auth) {
    this.auth = auth;
    this._jetFormAjaxUrl = '';
    this._formIds = { ...DEFAULT_FORM_IDS };
  }

  async getDeliveryMeta(postId, slugHint = '') {
    const html = await this.getEditPage(postId);
    const slug =
      slugHint ||
      this.readFormValue(html, '_slug') ||
      '';
    return {
      postId: String(postId),
      slug,
    };
  }

  async getEditPage(postId) {
    await this.auth.ensureLogin();
    const client = this.auth.getClient();
    const res = await client.get(`/dashboard/invitation/edit/?id=${postId}`, {
      headers: { Accept: 'text/html' },
    });
    if (res.status !== 200) {
      throw new Error(`Gagal buka halaman edit (HTTP ${res.status})`);
    }
    const html = String(res.data || '');
    if (html.includes('id="wds_auth_form"')) {
      await this.auth.ensureLogin({ force: true });
      return this.getEditPage(postId);
    }
    return html;
  }

  /** Cache JetForm ajax URL + form IDs from an edit-page HTML snapshot. */
  useEditContext(html) {
    this._jetFormAjaxUrl = extractJetFormAjaxUrl(html) || DEFAULT_JETFORM_AJAX;
    this._formIds = resolveFormIds(html);
    return { ajaxUrl: this._jetFormAjaxUrl, formIds: this._formIds };
  }

  extractMusicNonce(html) {
    const match =
      html.match(/formData\.append\(\s*['"]nonce['"]\s*,\s*['"]([a-f0-9]+)['"]\s*\)/i) ||
      html.match(/wds_form_edit_music[\s\S]{0,200}nonce['"]\s*,\s*['"]([a-f0-9]+)['"]/i);
    return match?.[1] || '';
  }

  extractWdsAjaxNonce(html) {
    return (
      html.match(/["']ajax_nonce["']\s*:\s*["']([a-f0-9]+)["']/i)?.[1] ||
      html.match(/var\s+WDS\s*=\s*\{[\s\S]*?["']ajax_nonce["']\s*:\s*["']([a-f0-9]+)["']/i)?.[1] ||
      ''
    );
  }

  extractBankOptions(html, formId = '') {
    const id = formId || this._formIds?.rekening || DEFAULT_FORM_IDS.rekening;
    const form =
      html.match(new RegExp(`data-form-id=["']${escapeRegExp(id)}["'][\\s\\S]*?<\\/form>`, 'i'))?.[0] ||
      html.match(/name=["']_nama_bank_1["'][\s\S]{0,50}/i)?.[0] ||
      '';
    // Prefer select inside discovered form; fallback: any bank select on page
    const scoped = form.includes('<select')
      ? form
      : html;
    const select =
      scoped.match(/<select[^>]*name=["']_nama_bank_1["'][\s\S]*?<\/select>/i)?.[0] ||
      html.match(/<select[^>]*name=["']_nama_bank_1["'][\s\S]*?<\/select>/i)?.[0] ||
      '';
    const opts = [];
    const re = /<option[^>]*value=["']([^"']*)["'][^>]*>([\s\S]*?)<\/option>/gi;
    let m;
    while ((m = re.exec(select))) {
      opts.push({
        value: m[1],
        label: String(m[2])
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim(),
      });
    }
    return opts;
  }

  findBankValue(banks, query) {
    const q = String(query || '').toLowerCase().trim();
    if (!q) return '';
    const exact = banks.find((b) => b.label.toLowerCase() === q);
    if (exact) return exact.value;
    const soft = banks.find(
      (b) =>
        b.label.toLowerCase().includes(q) ||
        q.includes(b.label.toLowerCase()) ||
        b.value.toLowerCase().includes(q.replace(/\s+/g, '-')),
    );
    return soft?.value || '';
  }

  async submitForm(postId, formId, fields, options = {}) {
    await this.auth.ensureLogin();
    const client = this.auth.getClient();
    const form = new FormData();
    form.append('_jfb_current_render_states[]', 'DEFAULT.STATE');
    form.append('_jet_engine_booking_form_id', String(formId));
    form.append(
      '_jet_engine_refer',
      `${config.zeya.baseUrl}/dashboard/invitation/edit/?id=${postId}`,
    );
    form.append('__queried_post_id', String(postId));
    form.append('post_id', String(postId));

    for (const [key, value] of Object.entries(fields || {})) {
      if (value === undefined || value === null) continue;
      form.append(key, String(value));
    }

    const ajaxUrl =
      options.ajaxUrl ||
      this._jetFormAjaxUrl ||
      DEFAULT_JETFORM_AJAX;

    const res = await client.post(ajaxUrl, form, {
      headers: {
        ...form.getHeaders(),
        Referer: `${config.zeya.baseUrl}/dashboard/invitation/edit/?id=${postId}`,
        'X-Requested-With': 'XMLHttpRequest',
        Accept: 'application/json, text/javascript, */*; q=0.01',
      },
      validateStatus: () => true,
      maxBodyLength: Infinity,
    });

    this.auth.persist();
    const data = res.data;
    if (!data || data.status !== 'success') {
      const message =
        data?.message ||
        data?.response?.message ||
        (typeof data === 'string' ? data.slice(0, 300) : JSON.stringify(data));
      throw new Error(`Gagal submit form ${formId}: ${strip(message)}`);
    }

    return data;
  }

  async setMusic(postId, musicUrl) {
    const html = await this.getEditPage(postId);
    const client = this.auth.getClient();
    const referer = `${config.zeya.baseUrl}/dashboard/invitation/edit/?id=${postId}`;

    // WeddingSaas 2.9+ (InvMoment): modal #form--audio → run_wds invitation_edit_audio
    const useWdsAudio =
      html.includes('id="form--audio"') ||
      html.includes("id='form--audio'") ||
      config.zeya.api === 'wds';

    if (useWdsAudio) {
      const nonce = this.extractWdsAjaxNonce(html);
      if (!nonce) {
        throw new Error('Gagal ambil nonce musik dari halaman edit');
      }
      const form = new FormData();
      form.append('action', 'run_wds');
      form.append('name', 'invitation_edit_audio');
      form.append('__nonce', nonce);
      form.append('post_id', String(postId));
      form.append('audio_type', 'default');
      form.append('selected', String(musicUrl));
      form.append('audio_custom_mode', 'upload');

      const res = await client.post('/wp-admin/admin-ajax.php', form, {
        headers: {
          ...form.getHeaders(),
          'X-Requested-With': 'XMLHttpRequest',
          Referer: referer,
        },
        validateStatus: () => true,
        maxBodyLength: Infinity,
      });
      this.auth.persist();
      if (!res.data?.success) {
        throw new Error(
          `Gagal set musik: ${strip(res.data?.data || res.data?.message || JSON.stringify(res.data))}`,
        );
      }
      return res.data;
    }

    const nonce = this.extractMusicNonce(html) || this.extractWdsAjaxNonce(html);
    if (!nonce) {
      throw new Error('Gagal ambil nonce musik dari halaman edit');
    }

    const body = new URLSearchParams({
      action: 'wds_form_edit_music',
      post_id: String(postId),
      selected: musicUrl,
      nonce,
    });

    const res = await client.post('/wp-admin/admin-ajax.php', body.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
        Referer: referer,
      },
      validateStatus: () => true,
    });

    this.auth.persist();
    if (!res.data?.success) {
      throw new Error(
        `Gagal set musik: ${strip(res.data?.message || JSON.stringify(res.data))}`,
      );
    }
    return res.data;
  }

  /**
   * Fill invitation with structured wedding data.
   * Photos are skipped (user sends via WhatsApp later).
   */
  isThemeSectionEditor(html) {
    return (
      /id=["']form--bride["']/i.test(html) ||
      /id=["']form--settings["']/i.test(html) ||
      /themes\/weddingsaas-wp\/assets\/js\/edit\.js/i.test(html)
    ) && !/data-form-id=["']\d+["']/i.test(html);
  }

  async runThemeAction(postId, name, fields = {}, options = {}) {
    await this.auth.ensureLogin();
    const html = await this.getEditPage(postId);
    const nonce = this.extractWdsAjaxNonce(html);
    if (!nonce) {
      throw new Error('Gagal ambil WDS ajax_nonce untuk editor tema');
    }

    const client = this.auth.getClient();
    const referer = `${config.zeya.baseUrl}/dashboard/invitation/edit/?id=${postId}`;

    const form = new FormData();
    form.append('action', 'run_wds_theme');
    form.append('name', String(name));
    form.append('__nonce', nonce);
    form.append('post_id', String(postId));
    for (const [key, value] of Object.entries(fields || {})) {
      if (value === undefined || value === null) continue;
      if (key === 'thumbnail' && Buffer.isBuffer(value)) {
        form.append('thumbnail', value, {
          filename: options.thumbnailName || 'thumbnail.png',
          contentType: 'image/png',
        });
        continue;
      }
      form.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
    }

    // setting_form selalu memvalidasi thumbnail — kirim placeholder jika belum ada
    if (name === 'setting_form' && !fields?.thumbnail) {
      form.append('thumbnail', PLACEHOLDER_PNG, {
        filename: 'thumbnail.png',
        contentType: 'image/png',
      });
    }

    const res = await client.post('/wp-admin/admin-ajax.php', form, {
      headers: {
        ...form.getHeaders(),
        'X-Requested-With': 'XMLHttpRequest',
        Referer: referer,
      },
      validateStatus: () => true,
      maxBodyLength: Infinity,
    });

    this.auth.persist();

    if (!res.data?.success) {
      throw new Error(
        `Gagal ${name}: ${strip(res.data?.data || res.data?.message || JSON.stringify(res.data))}`,
      );
    }
    return res.data;
  }

  /**
   * Editor tema WeddingSaas WP (section accordion) — dipakai banyak tema Premium InvMoment.
   */
  async fillInvitationTheme(postId, data, html) {
    const results = [];
    const warnings = [];
    const pushOk = (section, result) => results.push({ section, result, ok: true });
    const pushFail = (section, err) => {
      const msg = err?.message || String(err);
      warnings.push(`${section}: ${msg}`);
      results.push({ section, result: { error: msg }, ok: false });
    };
    const run = async (section, fn) => {
      try {
        pushOk(section, await fn());
      } catch (err) {
        pushFail(section, err);
      }
    };

    const slug = data.slug || this.readFormValue(html, 'slug');
    const title = data.title || this.readFormValue(html, 'title');
    const metaDesc =
      data.metaDescription ||
      this.readFormValue(html, 'description') ||
      (title
        ? `Tanpa Mengurangi Rasa Hormat. Kami Bermaksud Mengundang Bapak/Ibu/Saudara/i, Pada Acara Pernikahan ${title}`
        : '');

    await run('judul', () =>
      this.runThemeAction(postId, 'setting_form', {
        title: title || '',
        slug: slug || '',
        description: metaDesc || 'Tanpa Mengurangi Rasa Hormat.',
      }),
    );

    const { formWanita: wanita, formPria: pria, swapped } = resolveCoupleFormSlots(data);
    await run(swapped ? 'wanita(swapped←pria)' : 'wanita', () =>
      this.runThemeAction(postId, 'section_bride', {
        menu_bride: this.readFormValue(html, 'menu_bride') || 'Bride',
        title_bride: wanita.fullName || '',
        nickname_bride: wanita.nickname || '',
        description_bride: wanita.description || wanita.parents || '',
        ig_bride: stripAt(wanita.instagram),
        fb_bride: wanita.facebook || '',
        hide_image: 'no',
        bride_img: this.readFormValue(html, 'bride_img') || '',
      }),
    );
    await run(swapped ? 'pria(swapped←wanita)' : 'pria', () =>
      this.runThemeAction(postId, 'section_groom', {
        menu_groom: this.readFormValue(html, 'menu_groom') || 'Groom',
        title_groom: pria.fullName || '',
        nickname_groom: pria.nickname || '',
        description_groom: pria.description || pria.parents || '',
        ig_groom: stripAt(pria.instagram),
        fb_groom: pria.facebook || '',
        hide_image: 'no',
        groom_img: this.readFormValue(html, 'groom_img') || '',
      }),
    );

    const events = data.events || [];
    const akad =
      events.find((e) => /akad/i.test(e.name || '')) ||
      (events[0] && !/resepsi/i.test(events[0].name || '') ? events[0] : null);
    const resepsi =
      events.find((e) => /resepsi/i.test(e.name || '')) ||
      events.find((e) => e !== akad) ||
      events[0];
    const extra = events.find((e) => e !== akad && e !== resepsi);

    const eventFields = {
      menu_event: this.readFormValue(html, 'menu_event') || 'Event',
      title_event: resepsi?.name || 'Resepsi',
      date: toThemeDateTime(resepsi),
      date_end: resepsi?.timeEnd || '',
      timezone: data.timezone || this.readFormValue(html, 'timezone') || 'WIB',
      location: formatAddress(resepsi?.place || ''),
      address: formatAddress(resepsi?.address || ''),
      calender: 'yes',
      calender_btn: this.readFormValue(html, 'calender_btn') || 'Add to Calendar',
      akad_section: akad ? 'enable' : 'disable',
      event_section: extra ? 'yes' : 'no',
    };
    if (akad) {
      eventFields.akad_title = akad.name || 'Akad Nikah';
      eventFields.akad_date = toThemeDateTime(akad);
      eventFields.akad_date_end = akad.timeEnd || '';
      eventFields.akad_location = formatAddress(akad.place || '');
      eventFields.akad_address = formatAddress(akad.address || '');
    }
    if (extra) {
      eventFields.event_menu = this.readFormValue(html, 'event_menu') || 'Event';
      eventFields.event_title = extra.name || 'Ngunduh Mantu';
      eventFields.event_description =
        this.readFormValue(html, 'event_description') ||
        'Jangan lupa juga untuk hadir di acara kami';
      eventFields.newevent_date = toThemeDateTime(extra);
      eventFields.newevent_date_end = extra.timeEnd || '';
      eventFields.event_location = formatAddress(extra.place || '');
      eventFields.event_address = formatAddress(extra.address || '');
      eventFields.event_maps = extra.maps || '';
    }
    await run('acara', () => this.runThemeAction(postId, 'section_event', eventFields));

    const accounts = data.accounts || [];
    if (accounts.length || data.useDigitalEnvelope) {
      await run('rekening', async () => {
        // Aktifkan section gift jika masih off
        await this.runThemeAction(postId, 'enable_feature', {
          data: 'gift',
          section: 'Section Gift',
        });

        const banks = accounts.slice(0, 3).map((a) => ({
          name_bank: a.bank || a.bankValue || '',
          number_bank: digitsOnly(a.number),
          owner_bank: a.owner || '',
        }));
        if (!banks.length) {
          throw new Error('Data amplop kosong — isi manual');
        }

        return this.runThemeAction(postId, 'section_gift', {
          menu_gift: this.readFormValue(html, 'menu_gift') || 'Gift',
          title_gift: this.readFormValue(html, 'title_gift') || 'Tanda Kasih',
          description_gift:
            this.readFormValue(html, 'description_gift') ||
            'Terima kasih telah menambah semangat kegembiraan pernikahan kami dengan kehadiran dan hadiah indah Anda.',
          bank_gift: this.readFormValue(html, 'bank_gift') || 'Cashless',
          qris_section_gift: 'no',
          repeater: JSON.stringify({ repeater_bank: banks }),
          // juga kirim item pertama sebagai field biasa (beberapa tema baca ini)
          name_bank: banks[0]?.name_bank || '',
          number_bank: banks[0]?.number_bank || '',
          owner_bank: banks[0]?.owner_bank || '',
          address_wa_gift: digitsOnly(data.whatsappConfirm || ''),
        });
      });
    }

    if (data.musicUrl) {
      await run('musik', () => this.setMusic(postId, data.musicUrl));
    } else if (data.musicTitle) {
      warnings.push(`Musik: tidak ketemu di katalog — "${data.musicTitle}" (isi manual)`);
    }

    // Meta-tag digabung di setting_form (description)
    pushOk('meta-tag', { status: 'merged-into-judul' });

    return {
      postId,
      mode: 'theme-section',
      sections: results.filter((r) => r.ok).map((r) => r.section),
      failed: results.filter((r) => !r.ok).map((r) => r.section),
      warnings,
      ok: warnings.length === 0,
    };
  }

  async fillInvitation(postId, data) {
    const html = await this.getEditPage(postId);

    // InvMoment tema Premium baru: accordion section (bukan JetForm)
    if (this.isThemeSectionEditor(html)) {
      return this.fillInvitationTheme(postId, data, html);
    }

    const { formIds } = this.useEditContext(html);
    const banks = this.extractBankOptions(html, formIds.rekening);
    const results = [];
    const warnings = [];

    const pushOk = (section, result) => {
      results.push({ section, result, ok: true });
    };
    const pushFail = (section, err) => {
      const msg = err?.message || String(err);
      warnings.push(`${section}: ${msg}`);
      results.push({ section, result: { error: msg }, ok: false });
    };
    const run = async (section, fn) => {
      try {
        pushOk(section, await fn());
      } catch (err) {
        pushFail(section, err);
      }
    };

    const slug = data.slug;
    const title = data.title;
    const resepsi =
      (data.events || []).find((e) => /resepsi/i.test(e.name || '')) ||
      data.events?.[0];

    // Cover
    const coverRawCandidates = [
      resepsi?.dateText,
      resepsi?.dateISO,
      data.coverDateText,
      data.events?.[0]?.dateText,
      data.events?.[0]?.dateISO,
    ].filter(Boolean);
    let coverDate = '';
    for (const raw of coverRawCandidates) {
      coverDate = formatCoverDate(raw);
      if (coverDate) break;
    }
    if (!coverDate) {
      warnings.push(
        `Cover: gagal diformat dari ${coverRawCandidates.join(' | ') || '(kosong)'} — isi manual`,
      );
    }

    // Countdown
    const coverDateTime = normalizeDatetimeLocal(
      data.coverDateTime ||
        (resepsi?.dateISO ? `${resepsi.dateISO}T${guessTimeFromEvent(resepsi) || '08:00'}` : '') ||
        (data.events?.[0]?.dateISO
          ? `${data.events[0].dateISO}T${guessTimeFromEvent(data.events[0]) || '08:00'}`
          : ''),
    );
    if (!coverDateTime) {
      warnings.push('Countdown: tanggal resepsi tidak terdeteksi — isi manual');
    }

    const existingJudul = this.readFormValue(html, 'judul_undangan') || title;
    const existingSlug = this.readFormValue(html, '_slug') || slug;

    await run('judul', async () => {
      if (!coverDate && !coverDateTime) {
        // tetap simpan judul/slug
      }
      const result = await this.submitForm(postId, formIds.judul, {
        judul_undangan: title || existingJudul,
        _slug: slug || existingSlug,
        ...(coverDateTime ? { _tanggal_acara: coverDateTime } : {}),
        ...(coverDate ? { _tanggal_acara_cover: coverDate } : {}),
      });

      if (coverDate || coverDateTime) {
        const htmlAfter = await this.getEditPage(postId);
        this.useEditContext(htmlAfter);
        let savedCover = this.readFormValue(htmlAfter, '_tanggal_acara_cover');
        let savedCountdown = normalizeDatetimeLocal(
          this.readFormValue(htmlAfter, '_tanggal_acara'),
        );

        const coverOk = !coverDate || savedCover === coverDate;
        const countdownOk = !coverDateTime || savedCountdown === coverDateTime;
        if (!coverOk || !countdownOk) {
          await this.submitForm(postId, formIds.judul, {
            judul_undangan:
              title || existingJudul || this.readFormValue(htmlAfter, 'judul_undangan'),
            _slug: slug || existingSlug || this.readFormValue(htmlAfter, '_slug'),
            ...(coverDateTime ? { _tanggal_acara: coverDateTime } : {}),
            ...(coverDate ? { _tanggal_acara_cover: coverDate } : {}),
          });
          const htmlRetry = await this.getEditPage(postId);
          savedCover = this.readFormValue(htmlRetry, '_tanggal_acara_cover');
          savedCountdown = normalizeDatetimeLocal(
            this.readFormValue(htmlRetry, '_tanggal_acara'),
          );
          if (coverDate && savedCover !== coverDate) {
            warnings.push(
              `Cover: gagal tersimpan (dikirim "${coverDate}", form "${savedCover || '(kosong)'}") — isi manual`,
            );
          }
          if (coverDateTime && savedCountdown !== coverDateTime) {
            warnings.push(
              `Countdown: gagal tersimpan (dikirim "${coverDateTime}", form "${savedCountdown || '(kosong)'}") — isi manual`,
            );
          }
        }
      }

      if (coverDate) data.coverDateText = coverDate;
      if (coverDateTime) data.coverDateTime = coverDateTime;
      return result;
    });

    // Meta
    const metaJudul = title ? `The Wedding Of ${title}` : 'The Wedding Of';
    await run('meta-tag', () =>
      this.submitForm(postId, formIds.meta, {
        _meta_judul: metaJudul,
      }),
    );

    // Mempelai
    const { formWanita: wanita, formPria: pria, swapped } = resolveCoupleFormSlots(data);
    await run(swapped ? 'wanita(swapped←pria)' : 'wanita', () =>
      this.submitForm(postId, formIds.wanita, {
        _nama_lengkap_wanita: wanita.fullName || '',
        _nama_panggilan_wanita: wanita.nickname || '',
        _deskripsi_wanita: wanita.description || '',
        _keluarga_wanita: wanita.parents || '',
        _instagram_wanita: wanita.instagram || '',
        _facebook_wanita: wanita.facebook || '',
        _twitter_wanita: wanita.twitter || '',
        _tiktok_wanita: wanita.tiktok || '',
        _youtube_wanita: wanita.youtube || '',
      }),
    );
    await run(swapped ? 'pria(swapped←wanita)' : 'pria', () =>
      this.submitForm(postId, formIds.pria, {
        _nama_lengkap_pria: pria.fullName || '',
        _nama_panggilan_pria: pria.nickname || '',
        _deskripsi_pria: pria.description || '',
        _keluarga_pria: pria.parents || '',
        _instagram_pria: pria.instagram || '',
        _facebook_pria: pria.facebook || '',
        _twitter_pria: pria.twitter || '',
        _tiktok_pria: pria.tiktok || '',
        _youtube_pria: pria.youtube || '',
      }),
    );

    // Acara 1 & 2
    const event1 = data.events?.[0] || {};
    const event2 = data.events?.[1] || {};
    const event3 = data.events?.[2] || {};
    const acaraFields = {
      _nama_acara_1: event1.name || '',
      _tanggal_acara_1: event1.dateISO || '',
      _waktu_acara_1: event1.time || '',
      _lokasi_acara_1: formatAddress(event1.place || ''),
      _alamat_acara_1: formatAddress(event1.address || ''),
      _gmaps_link_acara_1: event1.maps || '',
      _gmaps_embed_acara_1: event1.mapsEmbed || '',
    };
    if (event2?.name) {
      acaraFields._acara_kedua = 'yes';
      acaraFields._nama_acara_2 = event2.name || '';
      acaraFields._tanggal_acara_2 = event2.dateISO || '';
      acaraFields._waktu_acara_2 = event2.time || '';
      acaraFields._lokasi_acara_2 = formatAddress(event2.place || '');
      acaraFields._alamat_acara_2 = formatAddress(event2.address || '');
      acaraFields._gmaps_link_acara_2 = event2.maps || '';
      acaraFields._gmaps_embed_acara_2 = event2.mapsEmbed || '';
    }
    await run('acara', () => this.submitForm(postId, formIds.acara, acaraFields));

    if (event3?.name || hasEventPayload(event3)) {
      const acara3Id = formIds.acara3 || formIds.acara;
      await run('acara-3', () =>
        this.submitForm(postId, acara3Id, {
          _acara_ketiga: 'yes',
          _nama_acara_3: event3.name || 'Ngunduh Mantu',
          _tanggal_acara_3: event3.dateISO || '',
          _waktu_acara_3: event3.time || '',
          _lokasi_acara_3: formatAddress(event3.place || ''),
          _alamat_acara_3: formatAddress(event3.address || ''),
          _gmaps_link_acara_3: event3.maps || '',
          _gmaps_embed_acara_3: event3.mapsEmbed || '',
        }),
      );
    }

    // Teks agama
    await run('teks-agama', async () => {
      const religionResult = await this.fillReligionTexts(postId, data.religion, {
        reuseContext: true,
      });
      return religionResult || { status: 'skipped' };
    });

    // Rekening
    const accounts = data.accounts || [];
    const rekening = {};
    if (accounts[0]) {
      rekening._nama_pemilik_rekening_1 = accounts[0].owner || '';
      rekening._no_rekening_1 = digitsOnly(accounts[0].number);
      rekening._nama_bank_1 =
        this.findBankValue(banks, accounts[0].bank) || accounts[0].bankValue || '';
    }
    if (accounts[1]) {
      rekening._rekening_kedua = 'yes';
      rekening._nama_pemilik_rekening_2 = accounts[1].owner || '';
      rekening._no_rekening_2 = digitsOnly(accounts[1].number);
      rekening._nama_bank_2 =
        this.findBankValue(banks, accounts[1].bank) || accounts[1].bankValue || '';
    }
    if (accounts[2]) {
      rekening._rekening_ketiga = 'yes';
      rekening._nama_pemilik_rekening_3 = accounts[2].owner || '';
      rekening._no_rekening_3 = digitsOnly(accounts[2].number);
      rekening._nama_bank_3 =
        this.findBankValue(banks, accounts[2].bank) || accounts[2].bankValue || '';
    }
    if (data.whatsappConfirm) {
      rekening._whatsapp = digitsOnly(data.whatsappConfirm);
    }
    if (Object.keys(rekening).length) {
      await run('rekening', () => this.submitForm(postId, formIds.rekening, rekening));
    } else if (data.useDigitalEnvelope) {
      warnings.push('Rekening: data amplop kosong — isi manual');
    }

    // Musik
    if (data.musicUrl) {
      await run('musik', () => this.setMusic(postId, data.musicUrl));
    } else if (data.musicTitle) {
      warnings.push(`Musik: tidak ketemu di katalog — "${data.musicTitle}" (isi manual)`);
    }

    return {
      postId,
      sections: results.filter((r) => r.ok).map((r) => r.section),
      failed: results.filter((r) => !r.ok).map((r) => r.section),
      warnings,
      ok: warnings.length === 0,
    };
  }

  /**
   * Baca data form mempelai dari halaman edit, lalu tukar wanita ↔ pria.
   * Tidak perlu data gondongan ulang.
   */
  async swapCoupleForms(postId) {
    const html = await this.getEditPage(postId);
    const { formIds } = this.useEditContext(html);
    const wanita = this.extractCoupleSide(html, 'wanita');
    const pria = this.extractCoupleSide(html, 'pria');

    if (!wanita.fullName && !pria.fullName) {
      throw new Error('Data nama mempelai kosong di form — tidak ada yang ditukar');
    }

    await this.submitForm(postId, formIds.wanita, {
      _nama_lengkap_wanita: pria.fullName || '',
      _nama_panggilan_wanita: pria.nickname || '',
      _deskripsi_wanita: pria.description || '',
      _keluarga_wanita: pria.parents || '',
      _instagram_wanita: pria.instagram || '',
      _facebook_wanita: pria.facebook || '',
      _twitter_wanita: pria.twitter || '',
      _tiktok_wanita: pria.tiktok || '',
      _youtube_wanita: pria.youtube || '',
    });

    await this.submitForm(postId, formIds.pria, {
      _nama_lengkap_pria: wanita.fullName || '',
      _nama_panggilan_pria: wanita.nickname || '',
      _deskripsi_pria: wanita.description || '',
      _keluarga_pria: wanita.parents || '',
      _instagram_pria: wanita.instagram || '',
      _facebook_pria: wanita.facebook || '',
      _twitter_pria: wanita.twitter || '',
      _tiktok_pria: wanita.tiktok || '',
      _youtube_pria: wanita.youtube || '',
    });

    return {
      postId,
      before: { wanita, pria },
      after: { wanita: pria, pria: wanita },
      ok: true,
    };
  }

  extractCoupleSide(html, side) {
    const s = side === 'pria' ? 'pria' : 'wanita';
    return {
      fullName: this.readFormValue(html, `_nama_lengkap_${s}`),
      nickname: this.readFormValue(html, `_nama_panggilan_${s}`),
      description: this.readFormValue(html, `_deskripsi_${s}`),
      parents: this.readFormValue(html, `_keluarga_${s}`),
      instagram: this.readFormValue(html, `_instagram_${s}`),
      facebook: this.readFormValue(html, `_facebook_${s}`),
      twitter: this.readFormValue(html, `_twitter_${s}`),
      tiktok: this.readFormValue(html, `_tiktok_${s}`),
      youtube: this.readFormValue(html, `_youtube_${s}`),
    };
  }

  readFormValue(html, name) {
    const n = escapeRegExp(name);
    const input =
      html.match(
        new RegExp(`<input[^>]*name=["']${n}["'][^>]*value=["']([^"']*)["'][^>]*>`, 'i'),
      ) ||
      html.match(
        new RegExp(`<input[^>]*value=["']([^"']*)["'][^>]*name=["']${n}["'][^>]*>`, 'i'),
      );
    if (input?.[1] != null) return decodeHtml(input[1]);

    const textarea = html.match(
      new RegExp(`<textarea[^>]*name=["']${n}["'][^>]*>([\\s\\S]*?)<\\/textarea>`, 'i'),
    );
    if (textarea?.[1] != null) return decodeHtml(textarea[1]);

    return '';
  }

  async fillLoveStories(postId, stories) {
    const list = (stories || []).slice(0, 4);
    if (!list.length) {
      throw new Error('Love story kosong');
    }

    const html = await this.getEditPage(postId);
    const { formIds } = this.useEditContext(html);

    const fields = {};
    list.forEach((story, idx) => {
      const n = idx + 1;
      fields[`_judul_cerita_${n}`] = story.title || `Cerita ${n}`;
      fields[`_tanggal_cerita_${n}`] = story.date || '';
      fields[`_deskripsi_cerita_${n}`] = story.description || '';
      if (n >= 2) {
        fields[`_love_story_${n}`] = 'yes';
      }
    });

    return this.submitForm(postId, formIds.love, fields);
  }

  async fillReligionTexts(postId, religionRaw, options = {}) {
    const { key, texts } = getReligionTexts(religionRaw);
    // Islam / tidak terdeteksi: biarkan default template (kosong / tidak diubah)
    if (!key || key === 'islam' || !texts) return null;

    if (!options.reuseContext || !this._jetFormAjaxUrl) {
      const html = await this.getEditPage(postId);
      this.useEditContext(html);
    }
    const formId = this._formIds?.religion || DEFAULT_FORM_IDS.religion;

    const fields = {};

    if (texts.teks_quotes) fields._teks_quotes = texts.teks_quotes;
    if (texts.teks_pembuka) fields._teks_pembuka = texts.teks_pembuka;
    if (texts.teks_penutup) fields._teks_penutup = texts.teks_penutup;

    // Kristen / Katolik / Non-Muslim -> field NON MUSLIM
    if (key === 'kristen' || key === 'katolik') {
      fields['edit_text_kata_kata_sesuai_dengan_kepercayaan_agama[0][non_muslim_surat]'] =
        texts.non_muslim_surat || '';
      fields['edit_text_kata_kata_sesuai_dengan_kepercayaan_agama[0][non_muslim_kata_pengantar]'] =
        texts.non_muslim_kata_pengantar || '';
      fields.non_muslim_surat = texts.non_muslim_surat || '';
      fields.non_muslim_kata_pengantar = texts.non_muslim_kata_pengantar || '';
    }

    if (key === 'hindu') {
      fields['edit_text_kata_kata_sesuai_dengan_kepercayaan_agama[0][hindu_surat]'] =
        texts.hindu_surat || '';
      fields['edit_text_kata_kata_sesuai_dengan_kepercayaan_agama[0][hindu_kata_pengantar]'] =
        texts.hindu_kata_pengantar || '';
      fields.hindu_surat = texts.hindu_surat || '';
      fields.hindu_kata_pengantar = texts.hindu_kata_pengantar || '';
    }

    if (!Object.keys(fields).length) return null;

    const result = await this.submitForm(postId, formId, fields);
    return {
      section: `teks-agama-${key}`,
      result,
      religion: texts.label || key,
    };
  }
}

function extractJetFormAjaxUrl(html) {
  const fromSettings =
    html.match(
      /JetFormBuilderSettings\s*=\s*\{[\s\S]*?["']ajaxurl["']\s*:\s*["']([^"']+)["']/i,
    )?.[1] || '';
  if (fromSettings) {
    try {
      const u = new URL(fromSettings, config.zeya.baseUrl);
      return `${u.pathname}${u.search}`;
    } catch {
      return fromSettings.replace(config.zeya.baseUrl, '') || fromSettings;
    }
  }
  const key = html.match(/["']gfb_request_args_key["']\s*:\s*["']([^"']+)["']/i)?.[1];
  const val = html.match(/["']gfb_request_args_value["']\s*:\s*["']([^"']+)["']/i)?.[1];
  if (key && val) {
    return `/dashboard/invitation/edit/?${encodeURIComponent(key)}=${encodeURIComponent(val)}&method=ajax`;
  }
  return '';
}

function discoverFormIdByField(html, fieldName) {
  const fieldRe = new RegExp(`name=["']${escapeRegExp(fieldName)}["']`, 'i');
  const formRe = /<form\b([^>]*)>([\s\S]*?)<\/form>/gi;
  let m;
  while ((m = formRe.exec(html))) {
    const id = (m[1].match(/data-form-id=["'](\d+)["']/i) || [])[1];
    if (!id) continue;
    if (fieldRe.test(m[2])) return id;
  }
  return '';
}

function resolveFormIds(html) {
  const byField = (field, fallback) => discoverFormIdByField(html, field) || fallback;
  return {
    judul: byField('judul_undangan', DEFAULT_FORM_IDS.judul),
    meta: byField('_meta_judul', DEFAULT_FORM_IDS.meta),
    wanita: byField('_nama_lengkap_wanita', DEFAULT_FORM_IDS.wanita),
    pria: byField('_nama_lengkap_pria', DEFAULT_FORM_IDS.pria),
    acara: byField('_nama_acara_1', DEFAULT_FORM_IDS.acara),
    acara3: byField('_nama_acara_3', DEFAULT_FORM_IDS.acara3),
    rekening: byField('_nama_bank_1', DEFAULT_FORM_IDS.rekening),
    love: byField('_judul_cerita_1', DEFAULT_FORM_IDS.love),
    religion:
      byField('_teks_quotes', '') ||
      byField('_teks_pembuka', '') ||
      byField('non_muslim_surat', DEFAULT_FORM_IDS.religion) ||
      DEFAULT_FORM_IDS.religion,
  };
}

function stripAt(value) {
  return String(value || '')
    .trim()
    .replace(/^@+/, '');
}

/** Theme editor flatpickr: YYYY-MM-DD HH:mm */
function toThemeDateTime(event) {
  if (!event) return '';
  if (event.dateISO) {
    const time =
      String(event.time || '').match(/(\d{1,2})[.:](\d{2})/)?.slice(1, 3) ||
      null;
    const hh = time ? String(time[0]).padStart(2, '0') : '08';
    const mm = time ? time[1] : '00';
    return `${event.dateISO} ${hh}:${mm}`;
  }
  const local = normalizeDatetimeLocal(event.dateText || event.dateTime || '');
  return local ? local.replace('T', ' ') : '';
}

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function hasEventPayload(event) {
  if (!event || typeof event !== 'object') return false;
  return Boolean(
    event.dateISO ||
      event.dateText ||
      event.time ||
      event.place ||
      event.address ||
      event.maps,
  );
}

function strip(text) {
  return String(text || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}

/** datetime-local: YYYY-MM-DDTHH:mm */
function normalizeDatetimeLocal(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  // 2026-10-24T08:00 or 2026-10-24T08:00:00
  let m = raw.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{1,2}):(\d{2})(?::\d{2})?/);
  if (m) {
    return `${m[1]}T${String(m[2]).padStart(2, '0')}:${m[3]}`;
  }

  // date only
  m = raw.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (m) return `${m[1]}T08:00`;

  return '';
}

function guessTimeFromEvent(event) {
  const m = String(event?.time || '').match(/(\d{1,2})[.:](\d{2})/);
  if (!m) return '';
  return `${String(m[1]).padStart(2, '0')}:${m[2]}`;
}
