import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getIronSession } from 'iron-session';
import { env } from './env';

interface SessionData {
  admin?: boolean;
  oauthState?: string;
}

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), {
    password: env.sessionSecret,
    cookieName: 'kdm_session',
    ttl: 60 * 60 * 24 * 14,
    cookieOptions: { secure: env.appUrl.startsWith('https://'), sameSite: 'lax', httpOnly: true },
  });
}

/** Jede Dashboard-Seite und jede Server-Action ruft das zuerst auf. */
export async function requireAdmin() {
  const s = await getSession();
  if (!s.admin) redirect('/login');
  return s;
}
