import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { requireAdmin } from '@/lib/session';
import { saveToken } from '@/lib/account';
import { exchangeCode, toLongLived } from '@/lib/instagram/client';

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  const p = req.nextUrl.searchParams;
  const back = (q: string) => NextResponse.redirect(`${env.appUrl}/settings?${q}`);

  const expected = session.oauthState;
  session.oauthState = undefined;
  await session.save();
  if (p.get('error')) return back(`error=${encodeURIComponent(p.get('error_description') ?? 'Verbindung abgebrochen')}`);
  if (!expected || p.get('state') !== expected) return back('error=Sicherheitspr%C3%BCfung%20fehlgeschlagen%2C%20bitte%20erneut%20verbinden');

  try {
    const short = await exchangeCode(env.igAppId, env.igAppSecret, `${env.appUrl}/api/instagram/callback`, p.get('code') ?? '');
    const long = await toLongLived(env.igAppSecret, short);
    const a = await saveToken(long.access_token, long.expires_in);
    return back(`ok=${encodeURIComponent(`Verbunden mit @${a.username}`)}`);
  } catch (e) {
    return back(`error=${encodeURIComponent(e instanceof Error ? e.message : 'Verbindung fehlgeschlagen')}`);
  }
}
