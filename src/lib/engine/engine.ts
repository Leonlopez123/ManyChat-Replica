// Kern-Ablauf: Kommentar → (öffentliche Antwort) → Private Reply mit Button → Klick → Follow-Check → Lieferung.
// Keine Next.js-Abhängigkeiten, damit die Tests es direkt mit PGlite und einem Fake-Instagram prüfen können.
import { and, asc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import type { Db } from '@/lib/db';
import { automations, contacts, events, runs, type Account, type Automation, type EventKind, type Run } from '@/lib/db/schema';
import { GraphError, type IgButton, type IgMessage, type InstagramClient } from '@/lib/instagram/client';
import { fillTemplate, firstName, matchesKeywords, pickRandom } from './text';

export interface EngineDeps {
  db: Db;
  ig: InstagramClient;
  account: Account;
  appUrl: string;
}

export const DEFAULT_FOLLOW_PROMPT = 'Fast geschafft! Folg mir kurz und tipp dann auf den Button, dann schicke ich es dir sofort.';
const WINDOW_MS = 24 * 60 * 60 * 1000;
const STALE_CLAIM_SECONDS = 60;

// ---------- Webhook-Formate (nur die Felder, die wir nutzen) ----------

export interface CommentValue {
  id: string;
  text?: string;
  parent_id?: string;
  from?: { id: string; username?: string };
  media?: { id: string; media_product_type?: string };
}

export interface MessagingEvent {
  sender: { id: string };
  recipient: { id: string };
  timestamp?: number;
  postback?: { mid?: string; payload?: string; title?: string };
  message?: { mid?: string; text?: string; is_echo?: boolean; quick_reply?: { payload?: string } };
}

export interface WebhookBody {
  object?: string;
  entry?: { id?: string; time?: number; changes?: { field: string; value: CommentValue }[]; messaging?: MessagingEvent[] }[];
}

export type Outcome =
  | 'duplicate' | 'own_comment' | 'no_match' | 'already_ran' | 'dm_sent' | 'dm_failed'
  | 'echo' | 'message_logged' | 'ignored' | 'follow_prompt' | 'gate_closed' | 'delivered' | 'delivery_failed';

// ---------- Einstieg ----------

export async function handleWebhook(deps: EngineDeps, body: WebhookBody): Promise<Outcome[]> {
  const out: Outcome[] = [];
  for (const entry of body.entry ?? []) {
    if (entry.id && entry.id !== deps.account.igUserId) continue; // fremdes Konto
    for (const ch of entry.changes ?? []) {
      if (ch.field === 'comments') out.push(await handleComment(deps, ch.value));
    }
    for (const m of entry.messaging ?? []) out.push(await handleMessaging(deps, m));
  }
  return out;
}

// ---------- Kommentar ----------

export async function handleComment(deps: EngineDeps, v: CommentValue): Promise<Outcome> {
  const { db, ig, account } = deps;
  if (!v?.id || !v.from?.id || !v.media?.id) return 'ignored';
  if (!(await claimEvent(db, 'webhook_comment', `comment:${v.id}`, v))) return 'duplicate';
  if (v.from.id === account.igUserId) return 'own_comment';

  const automation = await findAutomation(deps, v.media.id, v.text ?? '');
  if (!automation) return 'no_match';

  const [contact] = await db
    .insert(contacts)
    .values({ accountId: account.id, igsid: v.from.id, username: v.from.username ?? null })
    .onConflictDoUpdate({
      target: [contacts.accountId, contacts.igsid],
      set: { username: sql`coalesce(excluded.username, ${contacts.username})` },
    })
    .returning();

  const [run] = await db
    .insert(runs)
    .values({ automationId: automation.id, contactId: contact.id, commentId: v.id, mediaId: v.media.id, commentText: v.text ?? '' })
    .onConflictDoNothing()
    .returning();
  if (!run) return 'already_ran';

  const reply = pickRandom(automation.publicReplies.filter(Boolean));
  if (reply) {
    try {
      const res = await ig.replyToComment(v.id, fillTemplate(reply, { username: contact.username }));
      await db.update(runs).set({ publicReplyId: res.id }).where(eq(runs.id, run.id));
    } catch (e) {
      await logError(db, run.id, 'public_reply', e); // weiter, die DM ist wichtiger
    }
  }

  const opening = buttonTemplate(fillTemplate(automation.openingText, { username: contact.username }), [
    { type: 'postback', title: automation.openingButtonLabel, payload: `RUN:${run.id}:YES` },
  ]);
  try {
    await ig.privateReply(v.id, opening);
    await db.update(runs).set({ status: 'dm_sent', dmSentAt: new Date() }).where(eq(runs.id, run.id));
    await logEvent(db, 'send', run.id, { step: 'opening' });
    return 'dm_sent';
  } catch (e) {
    await failRun(db, run.id, 'private_reply', e);
    return 'dm_failed';
  }
}

/** Reihenfolge: bestimmter Beitrag → "nächster Beitrag" → alle Beiträge; jeweils die älteste Automation zuerst. */
async function findAutomation(deps: EngineDeps, mediaId: string, text: string): Promise<Automation | null> {
  const { db, ig, account } = deps;
  const active = await db
    .select()
    .from(automations)
    .where(and(eq(automations.accountId, account.id), eq(automations.active, true)))
    .orderBy(asc(automations.createdAt));
  const matching = active.filter((a) => matchesKeywords(text, a.keywords, a.excludeKeywords));

  const single = matching.find((a) => (a.postScope === 'single' || a.postScope === 'next') && a.mediaId === mediaId);
  if (single) return single;

  const unboundNext = matching.filter((a) => a.postScope === 'next' && !a.mediaId);
  if (unboundNext.length) {
    let published: Date | null = null;
    try {
      const m = await ig.getMedia(mediaId);
      published = m.timestamp ? new Date(m.timestamp) : null;
    } catch (e) {
      await logError(db, null, 'get_media', e);
    }
    for (const a of unboundNext) {
      if (!published || !a.activatedAt || published < a.activatedAt) continue;
      const [bound] = await db
        .update(automations)
        .set({ mediaId })
        .where(and(eq(automations.id, a.id), isNull(automations.mediaId)))
        .returning();
      if (bound) return bound;
    }
  }

  return matching.find((a) => a.postScope === 'all') ?? null;
}

// ---------- Klick / Nachricht ----------

const PAYLOAD = /^RUN:([0-9a-f-]{36}):(YES|CHECK)$/;

export async function handleMessaging(deps: EngineDeps, m: MessagingEvent): Promise<Outcome> {
  const { db, ig, account } = deps;
  if (m.message?.is_echo || m.sender?.id === account.igUserId) return 'echo';

  const payload = m.postback?.payload ?? m.message?.quick_reply?.payload;
  const mid = m.postback?.mid ?? m.message?.mid;
  const kind: EventKind = payload ? 'webhook_postback' : 'webhook_message';
  if (mid && !(await claimEvent(db, kind, `msg:${mid}`, m))) return 'duplicate';

  const now = new Date();
  await db
    .update(contacts)
    .set({ lastInteractionAt: now })
    .where(and(eq(contacts.accountId, account.id), eq(contacts.igsid, m.sender.id)));
  if (!payload) return 'message_logged';

  const match = PAYLOAD.exec(payload);
  if (!match) return 'ignored';
  const runId = match[1];

  // Atomarer Claim: nur ein gleichzeitiger Klick darf weitermachen (Doppeltipp, doppelte Zustellung).
  const [run] = await db
    .update(runs)
    .set({ status: 'clicked', clickedAt: sql`coalesce(${runs.clickedAt}, now())`, windowExpiresAt: new Date(now.getTime() + WINDOW_MS) })
    .where(
      and(
        eq(runs.id, runId),
        inArray(runs.contactId, db.select({ id: contacts.id }).from(contacts).where(and(eq(contacts.accountId, account.id), eq(contacts.igsid, m.sender.id)))),
        or(
          inArray(runs.status, ['dm_sent', 'follow_pending']),
          and(eq(runs.status, 'clicked'), lt(runs.updatedAt, sql`now() - make_interval(secs => ${STALE_CLAIM_SECONDS})`)),
        ),
      ),
    )
    .returning();
  if (!run) return 'ignored';
  if (mid) await db.update(events).set({ runId: run.id }).where(eq(events.dedupeKey, `msg:${mid}`));

  const [automation] = await db.select().from(automations).where(eq(automations.id, run.automationId));
  if (!automation) return 'ignored';

  let vorname: string | null = null;
  if (automation.followGate) {
    let follows: boolean | null = null;
    try {
      const p = await ig.getProfile(m.sender.id);
      follows = p.is_user_follow_business === true;
      vorname = firstName(p.name);
      await db
        .update(contacts)
        .set({ username: p.username ?? undefined, firstName: vorname ?? undefined, isFollower: follows, followerCheckedAt: new Date() })
        .where(eq(contacts.id, run.contactId));
    } catch (e) {
      await logError(db, run.id, 'follow_check', e); // bei unserem Fehler den Lead nicht blockieren
    }

    if (follows === false) {
      if (run.followAttempts < automation.maxFollowAttempts) {
        const prompt = buttonTemplate(fillTemplate(automation.followPromptText || DEFAULT_FOLLOW_PROMPT, { vorname }), [
          { type: 'postback', title: automation.followButtonLabel, payload: `RUN:${run.id}:CHECK` },
        ]);
        try {
          await ig.sendMessage(m.sender.id, prompt);
          await db
            .update(runs)
            .set({ status: 'follow_pending', followAttempts: run.followAttempts + 1 })
            .where(eq(runs.id, run.id));
          await logEvent(db, 'send', run.id, { step: 'follow_prompt', attempt: run.followAttempts + 1 });
          return 'follow_prompt';
        } catch (e) {
          await failRun(db, run.id, 'follow_prompt', e);
          return 'delivery_failed';
        }
      }
      if (!automation.deliverWhenGateExhausted) {
        await db.update(runs).set({ status: 'failed', error: 'Folgen nach allen Versuchen nicht bestätigt' }).where(eq(runs.id, run.id));
        return 'gate_closed';
      }
    }
  } else {
    vorname = await knownFirstName(db, run);
  }

  return deliver(deps, run, automation, m.sender.id, vorname);
}

async function deliver(deps: EngineDeps, run: Run, a: Automation, igsid: string, vorname: string | null): Promise<Outcome> {
  const { db, ig, appUrl } = deps;
  const username = await knownUsername(db, run);
  try {
    await ig.sendMessage(
      igsid,
      buttonTemplate(fillTemplate(a.deliveryText, { vorname, username }), [
        { type: 'web_url', title: a.deliveryButtonLabel, url: `${appUrl}/r/${run.id}/delivery` },
      ]),
    );
    await logEvent(db, 'send', run.id, { step: 'delivery' });
    if (a.bonusText && a.bonusUrl) {
      await ig.sendMessage(
        igsid,
        buttonTemplate(fillTemplate(a.bonusText, { vorname, username }), [
          { type: 'web_url', title: a.bonusButtonLabel || 'Zur Website', url: `${appUrl}/r/${run.id}/bonus` },
        ]),
      );
      await logEvent(db, 'send', run.id, { step: 'bonus' });
    }
    await db.update(runs).set({ status: 'delivered', deliveredAt: new Date(), error: null }).where(eq(runs.id, run.id));
    return 'delivered';
  } catch (e) {
    await failRun(db, run.id, 'delivery', e);
    return 'delivery_failed';
  }
}

// ---------- Hilfen ----------

export function buttonTemplate(text: string, buttons: IgButton[]): IgMessage {
  return { attachment: { type: 'template', payload: { template_type: 'button', text: text.slice(0, 640), buttons } } };
}

async function knownUsername(db: Db, run: Run) {
  const [c] = await db.select({ u: contacts.username }).from(contacts).where(eq(contacts.id, run.contactId));
  return c?.u ?? null;
}

async function knownFirstName(db: Db, run: Run) {
  const [c] = await db.select({ f: contacts.firstName }).from(contacts).where(eq(contacts.id, run.contactId));
  return c?.f ?? null;
}

/** Schreibt das Event mit Dedupe-Key; false, wenn es schon da war (Meta stellt manchmal doppelt zu). */
async function claimEvent(db: Db, kind: EventKind, key: string, payload: unknown): Promise<boolean> {
  const rows = await db
    .insert(events)
    .values({ kind, dedupeKey: key, payload: payload as object })
    .onConflictDoNothing()
    .returning({ id: events.id });
  return rows.length > 0;
}

export async function logEvent(db: Db, kind: EventKind, runId: string | null, payload: object) {
  await db.insert(events).values({ kind, runId, payload });
}

function errorPayload(step: string, e: unknown) {
  return e instanceof GraphError
    ? { step, message: e.message, status: e.status, code: e.code, subcode: e.subcode }
    : { step, message: e instanceof Error ? e.message : String(e) };
}

async function logError(db: Db, runId: string | null, step: string, e: unknown) {
  await logEvent(db, 'api_error', runId, errorPayload(step, e));
}

async function failRun(db: Db, runId: string, step: string, e: unknown) {
  const p = errorPayload(step, e);
  await db.update(runs).set({ status: 'failed', error: `${step}: ${p.message}` }).where(eq(runs.id, runId));
  await logEvent(db, 'api_error', runId, p);
}
