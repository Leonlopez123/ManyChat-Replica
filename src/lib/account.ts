import 'server-only';
import { eq } from 'drizzle-orm';
import { getDb, type Db } from './db';
import { account, events, type Account } from './db/schema';
import { decrypt, encrypt } from './crypto';
import { env } from './env';
import { createInstagramClient, getMe, refreshLongLived, subscribeWebhooks } from './instagram/client';

export async function getAccount(db?: Db): Promise<Account | null> {
  const d = db ?? (await getDb());
  const [a] = await d.select().from(account).limit(1);
  return a ?? null;
}

export function igClientFor(a: Account) {
  return createInstagramClient({ token: decrypt(a.accessTokenEnc, env.encryptionKey), igUserId: a.igUserId, graphVersion: env.graphVersion });
}

/**
 * Speichert einen (Long-lived) Token: prüft ihn bei Instagram, abonniert die Webhook-Felder fürs Konto
 * (die Schalter im Meta-Dashboard allein reichen nicht, siehe spike-meta.md) und ersetzt das bisherige Konto.
 */
export async function saveToken(token: string, expiresInSeconds = 60 * 24 * 3600): Promise<Account> {
  const db = await getDb();
  const me = await getMe(token, env.graphVersion);
  await subscribeWebhooks(token, env.graphVersion);
  const values = {
    igUserId: me.user_id,
    username: me.username,
    accessTokenEnc: encrypt(token, env.encryptionKey),
    tokenExpiresAt: new Date(Date.now() + expiresInSeconds * 1000),
    webhookSubscribedAt: new Date(),
  };
  const existing = await getAccount(db);
  if (existing) {
    // Gleiches Konto: aktualisieren (Automationen bleiben). Anderes Konto: alte Daten verwerfen.
    if (existing.igUserId === me.user_id) {
      const [a] = await db.update(account).set(values).where(eq(account.id, existing.id)).returning();
      return a;
    }
    await db.delete(account).where(eq(account.id, existing.id));
  }
  const [a] = await db.insert(account).values(values).returning();
  return a;
}

/** Erneuert den Token, wenn er in weniger als 10 Tagen abläuft. */
export async function refreshTokenIfDue(force = false) {
  const db = await getDb();
  const a = await getAccount(db);
  if (!a) return { status: 'kein Konto' as const };
  const daysLeft = (a.tokenExpiresAt.getTime() - Date.now()) / 864e5;
  if (!force && daysLeft > 10) return { status: 'nicht fällig' as const, daysLeft: Math.floor(daysLeft) };
  try {
    const res = await refreshLongLived(decrypt(a.accessTokenEnc, env.encryptionKey));
    await db
      .update(account)
      .set({ accessTokenEnc: encrypt(res.access_token, env.encryptionKey), tokenExpiresAt: new Date(Date.now() + res.expires_in * 1000) })
      .where(eq(account.id, a.id));
    await db.insert(events).values({ kind: 'token_refresh', payload: { ok: true, expiresIn: res.expires_in } });
    return { status: 'erneuert' as const };
  } catch (e) {
    await db.insert(events).values({ kind: 'api_error', payload: { step: 'token_refresh', message: e instanceof Error ? e.message : String(e) } });
    return { status: 'fehler' as const, message: e instanceof Error ? e.message : String(e) };
  }
}
