// Nur lokal: füllt die eingebettete Datenbank mit Beispieldaten zum Durchklicken (kein echter Instagram-Zugang).
// Aufruf: npm run migrate && node scripts/seed-demo.mjs
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const url = process.env.DATABASE_URL ?? 'pglite:./.data/db';
if (!url.startsWith('pglite:')) throw new Error('Demo-Daten nur für die lokale PGlite-Datenbank');
const db = new PGlite(path.resolve(url.slice('pglite:'.length)));
await db.exec('set search_path to kommentar_dm, public');

if ((await db.query('select count(*)::int n from account')).rows[0].n > 0) {
  console.log('Es gibt schon ein Konto – nichts zu tun.');
  process.exit(0);
}

const acc = (await db.query(
  `insert into account (ig_user_id, username, access_token_enc, token_expires_at, webhook_subscribed_at)
   values ('demo-ig', 'teamfinanzblick', 'demo', now() + interval '52 days', now()) returning id`,
)).rows[0].id;

const auto = (await db.query(
  `insert into automations (account_id, name, active, post_scope, media_id, activated_at, keywords, public_replies,
     opening_text, follow_prompt_text, delivery_text, delivery_url, bonus_text, bonus_url)
   values ($1, 'Kita-Leitfaden', true, 'single', 'demo-media-1', now() - interval '3 days', '{kita}',
     '{"Schau in deine DMs 📩","Hab dir gerade geschrieben ✉️"}',
     'Hey {{vorname}}, sende ich dir gerne. Bist du denn schon gefolgt?',
     'Fast geschafft! Folg mir kurz und tipp dann auf „Erledigt“ – dann kommt es sofort.',
     'Hier ist dein Leitfaden 👇', 'https://teamfinanzblick.de',
     'Und noch ein Extra für dich: Auf unserer Website findest du mehr dazu.', 'https://teamfinanzblick.de')
   returning id`,
  [acc],
)).rows[0].id;

await db.query(
  `insert into automations (account_id, name, active, post_scope, keywords, opening_text, delivery_text, delivery_url)
   values ($1, 'Steuer-Checkliste', false, 'next', '{steuer,checkliste}', 'Hey {{vorname}}! Willst du die Checkliste?', 'Bitte schön 👇', 'https://teamfinanzblick.de')`,
  [acc],
);

const people = [
  ['anna.k', 'Anna', true, 'delivered', 2],
  ['marco_88', 'Marco', true, 'delivered', 1],
  ['julia.m', 'Julia', false, 'follow_pending', 0],
  ['tom.weber', null, null, 'dm_sent', 0],
  ['sara_h', 'Sara', true, 'delivered', 0],
  ['ben.fx', null, null, 'failed', 0],
];
let i = 0;
for (const [username, first, follows, status, clicks] of people) {
  i++;
  const c = (await db.query(
    `insert into contacts (account_id, igsid, username, first_name, is_follower, follower_checked_at, last_interaction_at)
     values ($1, $2, $3, $4, $5, case when $5::boolean is null then null else now() end, now() - ($6 || ' hours')::interval) returning id`,
    [acc, `demo-${i}`, username, first, follows, i * 3],
  )).rows[0].id;
  const r = (await db.query(
    `insert into runs (automation_id, contact_id, comment_id, media_id, comment_text, status, follow_attempts, error,
       dm_sent_at, clicked_at, delivered_at, created_at)
     values ($1, $2, $3, 'demo-media-1', $4, $5, $6, $7,
       case when $5 <> 'failed' then now() - ($8 || ' hours')::interval end,
       case when $5 in ('delivered','follow_pending') then now() - ($8 || ' hours')::interval end,
       case when $5 = 'delivered' then now() - ($8 || ' hours')::interval end,
       now() - ($8 || ' hours')::interval) returning id`,
    [auto, c, `demo-comment-${i}`, i % 2 ? 'Kita' : 'kita bitte 🙏', status, status === 'follow_pending' ? 1 : 0,
      status === 'failed' ? 'private_reply: (#10) Antwort außerhalb des erlaubten Zeitfensters' : null, i * 3],
  )).rows[0].id;
  await db.query(`insert into events (run_id, kind, payload, created_at) values ($1, 'send', '{"step":"opening"}', now() - ($2 || ' hours')::interval)`, [r, i * 3]);
  if (status === 'delivered') await db.query(`insert into events (run_id, kind, payload) values ($1, 'send', '{"step":"delivery"}'), ($1, 'send', '{"step":"bonus"}')`, [r]);
  if (status === 'failed') await db.query(`insert into events (run_id, kind, payload) values ($1, 'api_error', '{"step":"private_reply","message":"(#10) Antwort außerhalb des erlaubten Zeitfensters","code":10}')`, [r]);
  for (let k = 0; k < clicks; k++) await db.query(`insert into link_clicks (run_id, target) values ($1, $2)`, [r, k ? 'bonus' : 'delivery']);
}
console.log('Demo-Daten angelegt.');
await db.close();
