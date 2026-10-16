import { and, inArray, lt, sql } from 'drizzle-orm';
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { events, runs } from '@/lib/db/schema';
import { env } from '@/lib/env';
import { safeEqual } from '@/lib/crypto';
import { refreshTokenIfDue } from '@/lib/account';

export const dynamic = 'force-dynamic';

// Aufruf durch Vercel Cron (GET) oder Railway Cron (POST): /api/cron/refresh-token bzw. /api/cron/cleanup
// mit Authorization: Bearer <CRON_SECRET>. Vercel setzt den Header selbst, wenn die Variable CRON_SECRET existiert.
async function run(req: NextRequest, { params }: { params: Promise<{ job: string }> }) {
  const auth = req.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
  if (!safeEqual(auth, env.cronSecret)) return new NextResponse('forbidden', { status: 403 });
  const { job } = await params;

  if (job === 'refresh-token') return NextResponse.json(await refreshTokenIfDue());

  if (job === 'cleanup') {
    const db = await getDb();
    const expired = await db
      .update(runs)
      .set({ status: 'expired' })
      .where(and(inArray(runs.status, ['clicked', 'follow_pending']), lt(runs.windowExpiresAt, sql`now()`)))
      .returning({ id: runs.id });
    // Private Reply nur 7 Tage nach Kommentar möglich: hängende Runs schließen
    const stale = await db
      .update(runs)
      .set({ status: 'expired' })
      .where(and(inArray(runs.status, ['commented', 'dm_sent']), lt(runs.createdAt, sql`now() - interval '7 days'`)))
      .returning({ id: runs.id });
    const purged = await db.delete(events).where(lt(events.createdAt, sql`now() - interval '90 days'`)).returning({ id: events.id });
    return NextResponse.json({ expired: expired.length + stale.length, purgedEvents: purged.length });
  }

  return new NextResponse('unknown job', { status: 404 });
}

export { run as GET, run as POST };
