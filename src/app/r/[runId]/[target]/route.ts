import { eq } from 'drizzle-orm';
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { automations, linkClicks, runs } from '@/lib/db/schema';

const UUID = /^[0-9a-f-]{36}$/;

// Klick-Tracking: zählt den Klick und leitet auf den Lead-Magneten weiter.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ runId: string; target: string }> }) {
  const { runId, target } = await params;
  if (!UUID.test(runId) || (target !== 'delivery' && target !== 'bonus')) return new NextResponse('Nicht gefunden', { status: 404 });

  const db = await getDb();
  const [row] = await db
    .select({ deliveryUrl: automations.deliveryUrl, bonusUrl: automations.bonusUrl })
    .from(runs)
    .innerJoin(automations, eq(automations.id, runs.automationId))
    .where(eq(runs.id, runId));
  const url = row && (target === 'delivery' ? row.deliveryUrl : row.bonusUrl);
  if (!url) return new NextResponse('Dieser Link ist nicht mehr gültig.', { status: 404 });

  await db.insert(linkClicks).values({ runId, target });
  return NextResponse.redirect(url, 302);
}
