import { after, NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { events } from '@/lib/db/schema';
import { env } from '@/lib/env';
import { safeEqual, validMetaSignature } from '@/lib/crypto';
import { getAccount, igClientFor } from '@/lib/account';
import { handleWebhook, type WebhookBody } from '@/lib/engine/engine';

export const dynamic = 'force-dynamic';

// Verify-Handshake beim Eintragen der Callback-URL im Meta-Dashboard.
export function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const ok = p.get('hub.mode') === 'subscribe' && safeEqual(p.get('hub.verify_token') ?? '', env.verifyToken);
  return ok ? new NextResponse(p.get('hub.challenge') ?? '') : new NextResponse('forbidden', { status: 403 });
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!validMetaSignature(raw, req.headers.get('x-hub-signature-256'), env.igAppSecret)) {
    return new NextResponse('bad signature', { status: 401 });
  }
  let body: WebhookBody;
  try {
    body = JSON.parse(raw);
  } catch {
    return new NextResponse('bad json', { status: 400 });
  }

  // Sofort 200, sonst stellt Meta erneut zu. Verarbeitung danach; Dedupe fängt Wiederholungen ab.
  after(async () => {
    const db = await getDb();
    try {
      const account = await getAccount(db);
      if (!account) return;
      await handleWebhook({ db, ig: igClientFor(account), account, appUrl: env.appUrl }, body);
    } catch (e) {
      await db.insert(events).values({ kind: 'api_error', payload: { step: 'webhook', message: e instanceof Error ? e.message : String(e) } });
    }
  });
  return NextResponse.json({ ok: true });
}
