import 'server-only';
import { sql } from 'drizzle-orm';
import { rowsOf, type Db } from './db';
import type { FunnelData } from '@/components/ui';

/** Trichter je Automation (oder alle zusammen, wenn keine ID). */
export async function funnels(db: Db, automationId?: string): Promise<Map<string, FunnelData>> {
  const where = automationId ? sql`where r.automation_id = ${automationId}` : sql``;
  const rows = rowsOf<{ automation_id: string; comments: string; dm_sent: string; clicked: string; delivered: string; link_clicked: string }>(
    await db.execute(sql`
      select r.automation_id,
        count(*) as comments,
        count(r.dm_sent_at) as dm_sent,
        count(r.clicked_at) as clicked,
        count(r.delivered_at) as delivered,
        count(*) filter (where exists (select 1 from link_clicks lc where lc.run_id = r.id)) as link_clicked
      from runs r
      ${where}
      group by r.automation_id`),
  );
  return new Map(
    rows.map((r) => [
      r.automation_id,
      { comments: +r.comments, dmSent: +r.dm_sent, clicked: +r.clicked, delivered: +r.delivered, linkClicked: +r.link_clicked },
    ]),
  );
}

export const emptyFunnel: FunnelData = { comments: 0, dmSent: 0, clicked: 0, delivered: 0, linkClicked: 0 };
