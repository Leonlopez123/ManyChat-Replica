'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db';
import { account } from '@/lib/db/schema';
import { refreshTokenIfDue, saveToken } from '@/lib/account';
import { requireAdmin } from '@/lib/session';

export async function saveManualToken(_prev: { error: string }, form: FormData): Promise<{ error: string }> {
  await requireAdmin();
  const token = String(form.get('token') ?? '').trim();
  if (token.length < 20) return { error: 'Das sieht nicht nach einem Token aus.' };
  let username: string;
  try {
    username = (await saveToken(token)).username;
  } catch (e) {
    return { error: `Instagram lehnt den Token ab: ${e instanceof Error ? e.message : String(e)}` };
  }
  revalidatePath('/', 'layout');
  redirect(`/settings?ok=${encodeURIComponent(`Verbunden mit @${username}`)}`);
}

export async function refreshNow() {
  await requireAdmin();
  const r = await refreshTokenIfDue(true);
  revalidatePath('/', 'layout');
  redirect(r.status === 'erneuert' ? '/settings?ok=Zugang%20erneuert' : `/settings?error=${encodeURIComponent(`Erneuern fehlgeschlagen: ${'message' in r ? r.message : r.status}`)}`);
}

export async function disconnect() {
  await requireAdmin();
  const db = await getDb();
  await db.delete(account); // kaskadiert Automationen, Kontakte und Verläufe
  revalidatePath('/', 'layout');
  redirect('/settings?ok=Konto%20getrennt');
}
