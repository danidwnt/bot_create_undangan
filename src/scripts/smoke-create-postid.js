// Unit test extract helpers via createInvitation return shape simulation
import { createRequire } from 'node:module';

// Re-implement same logic inline for smoke (helpers not exported)
function extractRedirectFromCreateResponse(raw) {
  if (!raw || typeof raw !== 'object') return '';
  const candidates = [
    raw.redirect,
    raw.data?.redirect,
    raw.data?.url,
    raw.url,
    raw.data?.data?.redirect,
  ];
  for (const c of candidates) {
    if (c && typeof c === 'string') return c;
  }
  return '';
}

function extractPostIdFromCreateResponse(raw) {
  if (!raw || typeof raw !== 'object') return '';
  const direct = [
    raw.post_id,
    raw.postId,
    raw.id,
    raw.data?.post_id,
    raw.data?.postId,
    raw.data?.id,
    raw.data?.invitation_id,
  ];
  for (const v of direct) {
    if (v != null && /^\d+$/.test(String(v))) return String(v);
  }
  const redirect = extractRedirectFromCreateResponse(raw);
  if (redirect) {
    try {
      const id = new URL(redirect, 'https://example.com').searchParams.get('id');
      if (id && /^\d+$/.test(id)) return id;
    } catch {
      // ignore
    }
    const m =
      String(redirect).match(/[?&]id=(\d+)/) ||
      String(redirect).match(/edit\/?\?id=(\d+)/);
    if (m?.[1]) return m[1];
  }
  const blob = JSON.stringify(raw);
  const fromBlob = blob.match(/invitation\/edit\/?\?id=(\d+)/i);
  if (fromBlob?.[1]) return fromBlob[1];
  return '';
}

const cases = [
  [
    { success: true, redirect: 'https://zeyainvitation.com/dashboard/invitation/edit/?id=136904' },
    '136904',
  ],
  [
    {
      success: true,
      data: {
        message: 'ok',
        redirect: 'https://invmoment.my.id/dashboard/invitation/edit/?id=99',
      },
    },
    '99',
  ],
  [
    { success: true, data: { message: 'ok', redirect: '/dashboard/invitation/edit/?id=123' } },
    '123',
  ],
  [{ success: true, data: { post_id: 55 } }, '55'],
];

let failed = 0;
for (const [raw, expected] of cases) {
  const got = extractPostIdFromCreateResponse(raw);
  const ok = got === expected;
  console.log(ok ? 'OK' : 'FAIL', expected, '=>', got, JSON.stringify(raw).slice(0, 80));
  if (!ok) failed += 1;
}
if (failed) process.exit(1);
console.log('postId extract OK');
