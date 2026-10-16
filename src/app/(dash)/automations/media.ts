import 'server-only';
import { getAccount, igClientFor } from '@/lib/account';
import type { IgMedia } from '@/lib/instagram/client';

/** Letzte 50 Beiträge für den Post-Picker; null = kein Konto verbunden. */
export async function loadMedia(): Promise<IgMedia[] | null> {
  const account = await getAccount();
  if (!account) return null;
  try {
    return await igClientFor(account).listMedia(50);
  } catch {
    return [];
  }
}
