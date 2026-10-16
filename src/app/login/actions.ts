'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { env } from '@/lib/env';
import { safeEqual } from '@/lib/crypto';
import { getSession } from '@/lib/session';

// Einfache Bremse gegen Passwort-Raten: 5 Versuche pro Minute und IP (im Speicher, reicht für einen Admin).
const attempts = new Map<string, number[]>();

export async function login(_prev: { error: string }, form: FormData): Promise<{ error: string }> {
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  const now = Date.now();
  const recent = (attempts.get(ip) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= 5) return { error: 'Zu viele Versuche. Bitte eine Minute warten.' };

  if (!safeEqual(String(form.get('password') ?? ''), env.adminPassword)) {
    attempts.set(ip, [...recent, now]);
    return { error: 'Passwort stimmt nicht.' };
  }
  attempts.delete(ip);
  const s = await getSession();
  s.admin = true;
  await s.save();
  redirect('/automations');
}

export async function logout() {
  const s = await getSession();
  s.destroy();
  redirect('/login');
}
