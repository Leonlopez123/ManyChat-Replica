import { expect, it } from 'vitest';
import { createDb, migrate } from '@/lib/db';
import { account, automations, contacts, linkClicks, runs } from '@/lib/db/schema';
import { funnels } from '@/lib/queries';

it('Trichter zählt jeden Run einmal, auch bei mehreren Link-Klicks', async () => {
  const database = await createDb('pglite:memory');
  await migrate(database);
  const { db } = database;
  const [acc] = await db.insert(account).values({ igUserId: '1', username: 'x', accessTokenEnc: 'x', tokenExpiresAt: new Date() }).returning();
  const [a] = await db.insert(automations).values({ accountId: acc.id, name: 'A', postScope: 'all', keywords: ['k'], openingText: 'o', deliveryText: 'd', deliveryUrl: 'https://x' }).returning();
  const ids: string[] = [];
  for (const [i, status] of (['delivered', 'delivered', 'dm_sent'] as const).entries()) {
    const [c] = await db.insert(contacts).values({ accountId: acc.id, igsid: `u${i}` }).returning();
    const now = new Date();
    const [r] = await db.insert(runs).values({
      automationId: a.id, contactId: c.id, commentId: `c${i}`, mediaId: 'm', commentText: 'k', status,
      dmSentAt: now, clickedAt: status === 'delivered' ? now : null, deliveredAt: status === 'delivered' ? now : null,
    }).returning();
    ids.push(r.id);
  }
  await db.insert(linkClicks).values([{ runId: ids[0], target: 'delivery' }, { runId: ids[0], target: 'bonus' }, { runId: ids[0], target: 'delivery' }]);
  expect(await funnels(db, a.id).then((m) => m.get(a.id))).toEqual({ comments: 3, dmSent: 3, clicked: 2, delivered: 2, linkClicked: 1 });
});
