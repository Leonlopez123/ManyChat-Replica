import { beforeEach, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { createDb, migrate, type Db } from '@/lib/db';
import { account, automations, contacts, events, runs, type Account } from '@/lib/db/schema';
import { handleWebhook, type EngineDeps, type WebhookBody } from '@/lib/engine/engine';
import { GraphError, type IgMessage, type IgProfile, type InstagramClient } from '@/lib/instagram/client';

const ME = '17841456283541694';
const LEAD = '1627007342297371';

class FakeIg implements InstagramClient {
  sent: { to: string; kind: 'private' | 'dm' | 'reply'; message: IgMessage | string }[] = [];
  follows = false;
  failPrivateReply = false;
  profileFails = false;
  mediaTimestamp = new Date().toISOString();
  async replyToComment(commentId: string, text: string) { this.sent.push({ to: commentId, kind: 'reply', message: text }); return { id: `r_${commentId}` }; }
  async privateReply(commentId: string, message: IgMessage) {
    if (this.failPrivateReply) throw new GraphError('(#10) Outside window', 400, 10);
    this.sent.push({ to: commentId, kind: 'private', message }); return { recipient_id: LEAD };
  }
  async sendMessage(igsid: string, message: IgMessage) { this.sent.push({ to: igsid, kind: 'dm', message }); return {}; }
  async getProfile(): Promise<IgProfile> {
    if (this.profileFails) throw new GraphError('boom', 500, 2);
    return { username: 'fatima', name: 'Fatima Muster', is_user_follow_business: this.follows };
  }
  async getMedia(id: string) { return { id, timestamp: this.mediaTimestamp }; }
  async listMedia() { return []; }
}

const textOf = (m: IgMessage | string) =>
  typeof m === 'string' ? m : 'text' in m ? m.text : m.attachment.payload.text;
const buttonsOf = (m: IgMessage | string) => (typeof m !== 'string' && 'attachment' in m ? m.attachment.payload.buttons : []);

let db: Db;
let ig: FakeIg;
let acc: Account;
let deps: EngineDeps;

const comment = (id: string, text: string, from = LEAD, media = 'm1'): WebhookBody => ({
  object: 'instagram',
  entry: [{ id: ME, changes: [{ field: 'comments', value: { id, text, from: { id: from, username: 'fatima' }, media: { id: media } } }] }],
});
const click = (payload: string, mid: string, from = LEAD): WebhookBody => ({
  object: 'instagram',
  entry: [{ id: ME, messaging: [{ sender: { id: from }, recipient: { id: ME }, postback: { mid, payload } }] }],
});
const lastPayload = () => {
  const btn = buttonsOf(ig.sent.at(-1)!.message)[0];
  return btn && btn.type === 'postback' ? btn.payload : '';
};

async function addAutomation(over: Partial<typeof automations.$inferInsert> = {}) {
  const [a] = await db
    .insert(automations)
    .values({
      accountId: acc.id,
      name: 'Kita',
      active: true,
      postScope: 'single',
      mediaId: 'm1',
      activatedAt: new Date(Date.now() - 60_000),
      keywords: ['kita'],
      publicReplies: ['Schau in deine DMs 📩'],
      openingText: 'Hey {{vorname}}, sende ich dir gerne. Bist du denn schon gefolgt?',
      followGate: true,
      followPromptText: 'Folg mir kurz und tipp dann auf Erledigt',
      deliveryText: 'Hier ist dein Leitfaden, {{vorname}} 👇',
      deliveryUrl: 'https://example.com/leitfaden',
      bonusText: 'Und noch ein Bonus:',
      bonusUrl: 'https://teamfinanzblick.de',
      ...over,
    })
    .returning();
  return a;
}

beforeEach(async () => {
  const database = await createDb('pglite:memory');
  await migrate(database);
  db = database.db;
  [acc] = await db
    .insert(account)
    .values({ igUserId: ME, username: 'teamfinanzblick', accessTokenEnc: 'x', tokenExpiresAt: new Date(Date.now() + 864e5) })
    .returning();
  ig = new FakeIg();
  deps = { db, ig, account: acc, appUrl: 'https://app.test' };
});

describe('Kern-Ablauf F02/F03', () => {
  it('Lead folgt noch nicht: DM → Ja → Follow-Aufforderung → Erledigt → Leitfaden + Bonus', async () => {
    await addAutomation();
    expect(await handleWebhook(deps, comment('c1', 'KITA bitte!'))).toEqual(['dm_sent']);
    expect(ig.sent.map((s) => s.kind)).toEqual(['reply', 'private']);
    expect(textOf(ig.sent[1].message)).toBe('Hey fatima, sende ich dir gerne. Bist du denn schon gefolgt?');

    expect(await handleWebhook(deps, click(lastPayload(), 'p1'))).toEqual(['follow_prompt']);
    expect(lastPayload()).toMatch(/:CHECK$/);

    ig.follows = true;
    expect(await handleWebhook(deps, click(lastPayload(), 'p2'))).toEqual(['delivered']);
    const [delivery, bonus] = ig.sent.slice(-2);
    expect(textOf(delivery.message)).toBe('Hier ist dein Leitfaden, Fatima 👇');
    expect(buttonsOf(delivery.message)[0]).toMatchObject({ type: 'web_url', url: expect.stringMatching(/^https:\/\/app\.test\/r\/.+\/delivery$/) });
    expect(buttonsOf(bonus.message)[0]).toMatchObject({ url: expect.stringMatching(/\/bonus$/) });

    const [run] = await db.select().from(runs);
    expect(run.status).toBe('delivered');
    expect(run.followAttempts).toBe(1);
    const [c] = await db.select().from(contacts);
    expect(c).toMatchObject({ isFollower: true, firstName: 'Fatima' });
  });

  it('Lead folgt schon: Ja liefert sofort', async () => {
    await addAutomation();
    ig.follows = true;
    await handleWebhook(deps, comment('c1', 'kita'));
    expect(await handleWebhook(deps, click(lastPayload(), 'p1'))).toEqual(['delivered']);
  });

  it('nach max. Versuchen trotzdem liefern (Standard) oder freundlich stoppen', async () => {
    await addAutomation({ maxFollowAttempts: 1 });
    await handleWebhook(deps, comment('c1', 'kita'));
    expect(await handleWebhook(deps, click(lastPayload(), 'p1'))).toEqual(['follow_prompt']);
    expect(await handleWebhook(deps, click(lastPayload(), 'p2'))).toEqual(['delivered']);

    await db.update(automations).set({ deliverWhenGateExhausted: false });
    await handleWebhook(deps, comment('c2', 'kita', 'other', 'm1'));
    const p = lastPayload();
    await handleWebhook(deps, { entry: [{ id: ME, messaging: [{ sender: { id: 'other' }, recipient: { id: ME }, postback: { mid: 'q1', payload: p } }] }] });
    const p2 = lastPayload();
    expect(
      await handleWebhook(deps, { entry: [{ id: ME, messaging: [{ sender: { id: 'other' }, recipient: { id: ME }, postback: { mid: 'q2', payload: p2 } }] }] }),
    ).toEqual(['gate_closed']);
  });

  it('ohne Follow-Gate wird direkt geliefert, Profil nicht abgefragt', async () => {
    await addAutomation({ followGate: false });
    ig.profileFails = true;
    await handleWebhook(deps, comment('c1', 'kita'));
    expect(await handleWebhook(deps, click(lastPayload(), 'p1'))).toEqual(['delivered']);
  });

  it('Fehler beim Follow-Check blockiert den Lead nicht', async () => {
    await addAutomation();
    ig.profileFails = true;
    await handleWebhook(deps, comment('c1', 'kita'));
    expect(await handleWebhook(deps, click(lastPayload(), 'p1'))).toEqual(['delivered']);
    const errs = await db.select().from(events).where(eq(events.kind, 'api_error'));
    expect(errs).toHaveLength(1);
  });

  it('ohne Bonus nur eine Nachricht', async () => {
    await addAutomation({ bonusText: null, bonusUrl: null, followGate: false });
    await handleWebhook(deps, comment('c1', 'kita'));
    const before = ig.sent.length;
    await handleWebhook(deps, click(lastPayload(), 'p1'));
    expect(ig.sent.length - before).toBe(1);
  });
});

describe('Schutz vor Doppelversand und Fehlern', () => {
  it('doppelt zugestellter Kommentar → nur eine DM', async () => {
    await addAutomation();
    await handleWebhook(deps, comment('c1', 'kita'));
    expect(await handleWebhook(deps, comment('c1', 'kita'))).toEqual(['duplicate']);
    expect(ig.sent.filter((s) => s.kind === 'private')).toHaveLength(1);
  });

  it('zweiter Kommentar derselben Person unter demselben Post → keine zweite DM', async () => {
    await addAutomation();
    await handleWebhook(deps, comment('c1', 'kita'));
    expect(await handleWebhook(deps, comment('c2', 'kita nochmal'))).toEqual(['already_ran']);
  });

  it('gleichzeitiger Doppeltipp → nur eine Lieferung', async () => {
    await addAutomation({ followGate: false });
    await handleWebhook(deps, comment('c1', 'kita'));
    const p = lastPayload();
    const res = await Promise.all([handleWebhook(deps, click(p, 'p1')), handleWebhook(deps, click(p, 'p2'))]);
    expect(res.flat().sort()).toEqual(['delivered', 'ignored']);
    expect(ig.sent.filter((s) => s.kind === 'dm')).toHaveLength(2); // Leitfaden + Bonus, nicht 4
  });

  it('erneuter Klick nach Lieferung wird ignoriert', async () => {
    await addAutomation({ followGate: false });
    await handleWebhook(deps, comment('c1', 'kita'));
    const p = lastPayload();
    await handleWebhook(deps, click(p, 'p1'));
    expect(await handleWebhook(deps, click(p, 'p2'))).toEqual(['ignored']);
  });

  it('fremde Person kann den Button eines anderen Runs nicht auslösen', async () => {
    await addAutomation({ followGate: false });
    await handleWebhook(deps, comment('c1', 'kita'));
    expect(await handleWebhook(deps, click(lastPayload(), 'p1', 'someone_else'))).toEqual(['ignored']);
  });

  it('eigener Kommentar und Echo der eigenen Nachricht werden übersprungen', async () => {
    await addAutomation();
    expect(await handleWebhook(deps, comment('c1', 'Kita', ME))).toEqual(['own_comment']);
    expect(
      await handleWebhook(deps, { entry: [{ id: ME, messaging: [{ sender: { id: ME }, recipient: { id: LEAD }, message: { mid: 'e1', is_echo: true } }] }] }),
    ).toEqual(['echo']);
  });

  it('Private Reply schlägt fehl → Run failed mit Fehler im Log', async () => {
    await addAutomation();
    ig.failPrivateReply = true;
    expect(await handleWebhook(deps, comment('c1', 'kita'))).toEqual(['dm_failed']);
    const [run] = await db.select().from(runs);
    expect(run.status).toBe('failed');
    expect(run.error).toContain('Outside window');
  });

  it('Webhook für ein fremdes Konto wird ignoriert', async () => {
    await addAutomation();
    const body = comment('c1', 'kita');
    body.entry![0].id = 'not-me';
    expect(await handleWebhook(deps, body)).toEqual([]);
  });
});

describe('Trigger-Auswahl', () => {
  it('kein Keyword, Ausschluss-Wort, inaktiv → keine DM', async () => {
    await addAutomation({ excludeKeywords: ['kitaplatz'] });
    expect(await handleWebhook(deps, comment('c1', 'toller Beitrag'))).toEqual(['no_match']);
    expect(await handleWebhook(deps, comment('c2', 'suche Kitaplatz'))).toEqual(['no_match']);
    await db.update(automations).set({ active: false });
    expect(await handleWebhook(deps, comment('c3', 'kita'))).toEqual(['no_match']);
  });

  it('anderer Post → keine DM bei Einzel-Post-Automation, aber "alle Beiträge" greift', async () => {
    await addAutomation();
    expect(await handleWebhook(deps, comment('c1', 'kita', LEAD, 'm2'))).toEqual(['no_match']);
    await addAutomation({ name: 'Alle', postScope: 'all', mediaId: null, keywords: ['kita'] });
    expect(await handleWebhook(deps, comment('c2', 'kita', LEAD, 'm2'))).toEqual(['dm_sent']);
  });

  it('Einzel-Post hat Vorrang vor "alle Beiträge"', async () => {
    await addAutomation({ name: 'Alle', postScope: 'all', mediaId: null });
    const single = await addAutomation({ name: 'Einzeln' });
    await handleWebhook(deps, comment('c1', 'kita'));
    const [run] = await db.select().from(runs);
    expect(run.automationId).toBe(single.id);
  });

  it('"nächster Beitrag" bindet sich an den ersten neuen Post, alte Posts zählen nicht', async () => {
    const a = await addAutomation({ postScope: 'next', mediaId: null });
    ig.mediaTimestamp = new Date(Date.now() - 864e5).toISOString(); // vor Aktivierung
    expect(await handleWebhook(deps, comment('c1', 'kita', LEAD, 'old'))).toEqual(['no_match']);
    ig.mediaTimestamp = new Date().toISOString();
    expect(await handleWebhook(deps, comment('c2', 'kita', LEAD, 'new'))).toEqual(['dm_sent']);
    const [bound] = await db.select().from(automations).where(eq(automations.id, a.id));
    expect(bound.mediaId).toBe('new');
  });

  it('Datenbank-Constraint: Einzel-Post braucht einen Post', async () => {
    await expect(addAutomation({ mediaId: null })).rejects.toThrow();
    expect((await db.execute(sql`select 1`)) !== undefined).toBe(true);
  });
});
