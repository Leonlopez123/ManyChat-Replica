// Meta-Spike: prüft an einem echten Kommentar, ob Standard Access reicht.
// Kein Framework, keine Abhängigkeiten. Start: node --env-file=spike/.env spike/server.mjs
import http from 'node:http';
import crypto from 'node:crypto';

const {
  PORT = '3000',
  VERIFY_TOKEN,          // frei gewählt, gleich wie im Meta-Dashboard
  APP_SECRET,            // Instagram App Secret (App-Dashboard → Instagram → API-Setup)
  IG_ACCESS_TOKEN,       // Token aus dem Dashboard ("Generate token")
  IG_USER_ID,            // eigene Instagram-Professional-Account-ID
  KEYWORD = 'kita',
  DELIVERY_URL = 'https://example.com/leitfaden',
  BONUS_URL = 'https://example.com',
  GRAPH_VERSION = 'v25.0',
  DRY_RUN = '0',         // 1 = nichts an Meta senden, nur loggen
} = process.env;

const GRAPH = `https://graph.instagram.com/${GRAPH_VERSION}`;
const seenComments = new Set();
const log = (step, data) => console.log(new Date().toISOString(), step, JSON.stringify(data));

const normalize = (s) =>
  s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N} ]/gu, ' ');

async function graph(method, path, body) {
  if (DRY_RUN === '1') { log('DRY_RUN', { method, path, body }); return { dry: true, is_user_follow_business: false }; }
  const res = await fetch(`${GRAPH}${path}`, {
    method,
    headers: { Authorization: `Bearer ${IG_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  log(res.ok ? 'GRAPH_OK' : 'GRAPH_ERROR', { method, path, status: res.status, json });
  if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
  return json;
}

const buttonMessage = (text, buttons) => ({
  attachment: { type: 'template', payload: { template_type: 'button', text, buttons } },
});
const send = (igsid, message) => graph('POST', `/${IG_USER_ID}/messages`, { recipient: { id: igsid }, message });

async function onComment(v) {
  if (!v?.id || seenComments.has(v.id)) return;
  seenComments.add(v.id);
  if (v.from?.id === IG_USER_ID) return log('SKIP_OWN_COMMENT', { id: v.id });
  if (!normalize(v.text ?? '').includes(normalize(KEYWORD))) return log('NO_KEYWORD', { text: v.text });
  log('TEST_1_COMMENT_WEBHOOK_OK', { from: v.from, text: v.text, media: v.media?.id });

  await graph('POST', `/${v.id}/replies`, { message: 'Schau in deine DMs 📩' })
    .then(() => log('TEST_2_PUBLIC_REPLY_OK', {}))
    .catch((e) => log('TEST_2_PUBLIC_REPLY_FAILED', { e: e.message }));

  const opening = buttonMessage('Hey, sende ich dir gerne. Bist du denn schon gefolgt?', [
    { type: 'postback', title: 'Ja', payload: 'SPIKE:YES' },
  ]);
  try {
    await graph('POST', `/${IG_USER_ID}/messages`, { recipient: { comment_id: v.id }, message: opening });
    log('TEST_3_PRIVATE_REPLY_WITH_BUTTON_OK', {});
  } catch (e) {
    log('TEST_3_BUTTON_FAILED_TRYING_QUICK_REPLY', { e: e.message });
    await graph('POST', `/${IG_USER_ID}/messages`, {
      recipient: { comment_id: v.id },
      message: {
        text: 'Hey, sende ich dir gerne. Bist du denn schon gefolgt?',
        quick_replies: [{ content_type: 'text', title: 'Ja', payload: 'SPIKE:YES' }],
      },
    })
      .then(() => log('TEST_3_PRIVATE_REPLY_WITH_QUICK_REPLY_OK', {}))
      .catch((e2) => log('TEST_3_PRIVATE_REPLY_FAILED', { e: e2.message }));
  }
}

async function onClick(igsid, payload) {
  log('TEST_4_CLICK_WEBHOOK_OK', { igsid, payload });
  let follows = false;
  try {
    const p = await graph('GET', `/${igsid}?fields=username,name,is_user_follow_business`);
    follows = p.is_user_follow_business === true;
    log('TEST_5_FOLLOW_CHECK_OK', { username: p.username, follows });
  } catch (e) {
    return log('TEST_5_FOLLOW_CHECK_FAILED', { e: e.message });
  }
  if (!follows) {
    return send(igsid, buttonMessage('Folg mir kurz und tipp dann auf „Erledigt“ 🙂', [
      { type: 'postback', title: 'Erledigt', payload: 'SPIKE:CHECK' },
    ])).then(() => log('TEST_6_FOLLOW_PROMPT_SENT', {})).catch(() => {});
  }
  try {
    await send(igsid, buttonMessage('Hier ist dein Leitfaden 👇', [{ type: 'web_url', title: 'Öffnen', url: DELIVERY_URL }]));
    await send(igsid, buttonMessage('Und noch ein Bonus für dich:', [{ type: 'web_url', title: 'Zur Website', url: BONUS_URL }]));
    log('TEST_7_DELIVERY_OK', {});
  } catch (e) {
    log('TEST_7_DELIVERY_FAILED', { e: e.message });
  }
}

function validSignature(raw, header) {
  if (!header?.startsWith('sha256=')) return false;
  const expected = crypto.createHmac('sha256', APP_SECRET).update(raw).digest('hex');
  const got = header.slice(7);
  return got.length === expected.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname !== '/webhook') { res.writeHead(404).end(); return; }

  if (req.method === 'GET') {
    const ok = url.searchParams.get('hub.mode') === 'subscribe' && url.searchParams.get('hub.verify_token') === VERIFY_TOKEN;
    log(ok ? 'VERIFY_OK' : 'VERIFY_FAILED', {});
    res.writeHead(ok ? 200 : 403).end(ok ? url.searchParams.get('hub.challenge') : '');
    return;
  }

  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks);
  if (!validSignature(raw, req.headers['x-hub-signature-256'])) {
    log('BAD_SIGNATURE', {});
    res.writeHead(401).end();
    return;
  }
  res.writeHead(200).end('EVENT_RECEIVED'); // sofort antworten, dann verarbeiten

  const body = JSON.parse(raw.toString('utf8'));
  log('WEBHOOK', body);
  for (const entry of body.entry ?? []) {
    for (const ch of entry.changes ?? []) {
      if (ch.field === 'comments') await onComment(ch.value).catch((e) => log('ERROR', { e: e.message }));
    }
    for (const m of entry.messaging ?? []) {
      if (m.message?.is_echo) continue;
      const payload = m.postback?.payload ?? m.message?.quick_reply?.payload;
      if (payload?.startsWith('SPIKE:')) await onClick(m.sender.id, payload).catch((e) => log('ERROR', { e: e.message }));
    }
  }
}).listen(Number(PORT), () => log('LISTENING', { port: PORT, dryRun: DRY_RUN === '1' }));
