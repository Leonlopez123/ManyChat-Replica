'use server';

import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import { contacts } from '@/lib/db/schema';
import { requireAdmin } from '@/lib/session';

/** DSGVO-Löschung: Kontakt, seine Durchläufe und Klicks (kaskadiert); Events behalten nur noch run_id = null. */
export async function deleteContact(id: string) {
  await requireAdmin();
  const db = await getDb();
  await db.delete(contacts).where(eq(contacts.id, id));
  redirect('/contacts?ok=Kontakt%20und%20zugeh%C3%B6rige%20Daten%20gel%C3%B6scht');
}
