import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { requireAdmin } from '@/lib/session';
import { authorizeUrl } from '@/lib/instagram/client';

export async function GET() {
  const session = await requireAdmin();
  session.oauthState = crypto.randomBytes(16).toString('hex');
  await session.save();
  return NextResponse.redirect(authorizeUrl(env.igAppId, `${env.appUrl}/api/instagram/callback`, session.oauthState));
}
