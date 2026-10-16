'use server';

import { and, eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { automations } from '@/lib/db/schema';
import { getAccount } from '@/lib/account';
import { requireAdmin } from '@/lib/session';
import { normalizeKeywords } from '@/lib/engine/text';

const label = z.string().trim().min(1, 'Bitte ausfüllen').max(20, 'Höchstens 20 Zeichen (Instagram-Limit für Buttons)');
const dmText = z.string().trim().min(1, 'Bitte ausfüllen').max(640, 'Höchstens 640 Zeichen (Instagram-Limit)');
const httpsUrl = z.string().trim().url('Bitte eine vollständige Adresse mit https:// angeben').refine((u) => u.startsWith('https://'), 'Bitte https:// verwenden');

const schema = z
  .object({
    name: z.string().trim().min(1, 'Bitte einen Namen vergeben').max(80),
    active: z.boolean(),
    postScope: z.enum(['single', 'all', 'next']),
    mediaId: z.string().trim().optional(),
    mediaPermalink: z.string().trim().optional(),
    mediaThumbnailUrl: z.string().trim().optional(),
    keywords: z.array(z.string()).transform(normalizeKeywords).refine((k) => k.length > 0, 'Mindestens ein Stichwort'),
    excludeKeywords: z.array(z.string()).transform(normalizeKeywords),
    publicReplies: z.array(z.string().trim().max(300, 'Höchstens 300 Zeichen')).transform((l) => l.filter(Boolean)).pipe(z.array(z.string()).max(3)),
    openingText: dmText,
    openingButtonLabel: label,
    followGate: z.boolean(),
    followPromptText: z.string().trim().max(640, 'Höchstens 640 Zeichen'),
    followButtonLabel: label,
    maxFollowAttempts: z.coerce.number().int().min(1).max(10),
    deliverWhenGateExhausted: z.boolean(),
    deliveryText: dmText,
    deliveryUrl: httpsUrl,
    deliveryButtonLabel: label,
    bonusText: z.string().trim().max(640, 'Höchstens 640 Zeichen'),
    bonusUrl: z.union([z.literal(''), httpsUrl]),
    bonusButtonLabel: z.string().trim().max(20, 'Höchstens 20 Zeichen'),
  })
  .superRefine((v, ctx) => {
    if (v.postScope === 'single' && !v.mediaId) ctx.addIssue({ code: 'custom', path: ['mediaId'], message: 'Bitte einen Beitrag auswählen' });
    if (!!v.bonusText !== !!v.bonusUrl)
      ctx.addIssue({ code: 'custom', path: [v.bonusText ? 'bonusUrl' : 'bonusText'], message: 'Für den Bonus bitte Text und Link angeben (oder beides leer lassen)' });
  });

export interface FormState {
  errors: Record<string, string>;
  message?: string;
}

function read(form: FormData) {
  const s = (k: string) => String(form.get(k) ?? '');
  return {
    name: s('name'),
    active: form.get('active') === 'on',
    postScope: s('postScope'),
    mediaId: s('mediaId') || undefined,
    mediaPermalink: s('mediaPermalink') || undefined,
    mediaThumbnailUrl: s('mediaThumbnailUrl') || undefined,
    keywords: form.getAll('keywords').map(String),
    excludeKeywords: form.getAll('excludeKeywords').map(String),
    publicReplies: form.getAll('publicReplies').map(String),
    openingText: s('openingText'),
    openingButtonLabel: s('openingButtonLabel'),
    followGate: form.get('followGate') === 'on',
    followPromptText: s('followPromptText'),
    followButtonLabel: s('followButtonLabel'),
    maxFollowAttempts: s('maxFollowAttempts'),
    deliverWhenGateExhausted: form.get('deliverWhenGateExhausted') === 'on',
    deliveryText: s('deliveryText'),
    deliveryUrl: s('deliveryUrl'),
    deliveryButtonLabel: s('deliveryButtonLabel'),
    bonusText: s('bonusText'),
    bonusUrl: s('bonusUrl'),
    bonusButtonLabel: s('bonusButtonLabel'),
  };
}

export async function saveAutomation(id: string | null, _prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = schema.safeParse(read(form));
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const i of parsed.error.issues) errors[String(i.path[0])] ??= i.message;
    return { errors, message: 'Bitte die markierten Felder prüfen.' };
  }
  const db = await getDb();
  const account = await getAccount(db);
  if (!account) return { errors: {}, message: 'Bitte zuerst unter Einstellungen dein Instagram-Konto verbinden.' };

  const v = parsed.data;
  const [existing] = id ? await db.select().from(automations).where(eq(automations.id, id)) : [];
  if (id && !existing) return { errors: {}, message: 'Diese Automation gibt es nicht mehr.' };

  const scopeChanged = existing && existing.postScope !== v.postScope;
  const values = {
    accountId: account.id,
    name: v.name,
    active: v.active,
    postScope: v.postScope,
    // "Nächster Beitrag" bindet sich selbst; bei Wechsel dorthin die alte Bindung lösen
    mediaId: v.postScope === 'single' ? v.mediaId! : v.postScope === 'next' && !scopeChanged ? (existing?.mediaId ?? null) : null,
    mediaPermalink: v.postScope === 'single' ? (v.mediaPermalink ?? null) : null,
    mediaThumbnailUrl: v.postScope === 'single' ? (v.mediaThumbnailUrl ?? null) : null,
    activatedAt: v.active ? (existing?.active && !scopeChanged ? existing.activatedAt : new Date()) : (existing?.activatedAt ?? null),
    keywords: v.keywords,
    excludeKeywords: v.excludeKeywords,
    publicReplies: v.publicReplies,
    openingText: v.openingText,
    openingButtonLabel: v.openingButtonLabel,
    followGate: v.followGate,
    followPromptText: v.followPromptText,
    followButtonLabel: v.followButtonLabel,
    maxFollowAttempts: v.maxFollowAttempts,
    deliverWhenGateExhausted: v.deliverWhenGateExhausted,
    deliveryText: v.deliveryText,
    deliveryUrl: v.deliveryUrl,
    deliveryButtonLabel: v.deliveryButtonLabel,
    bonusText: v.bonusText || null,
    bonusUrl: v.bonusUrl || null,
    bonusButtonLabel: v.bonusButtonLabel || 'Zur Website',
  };

  let savedId = id;
  if (existing) {
    await db.update(automations).set(values).where(eq(automations.id, existing.id));
  } else {
    const [row] = await db.insert(automations).values(values).returning({ id: automations.id });
    savedId = row.id;
  }
  revalidatePath('/automations');
  redirect(`/automations/${savedId}?ok=${encodeURIComponent(v.active ? 'Gespeichert und aktiv' : 'Gespeichert (noch nicht aktiv)')}`);
}

export async function toggleAutomation(id: string, active: boolean) {
  await requireAdmin();
  const db = await getDb();
  await db.update(automations).set({ active }).where(eq(automations.id, id));
  if (active) await db.update(automations).set({ activatedAt: new Date() }).where(and(eq(automations.id, id), isNull(automations.activatedAt)));
  revalidatePath('/automations');
}

export async function deleteAutomation(id: string) {
  await requireAdmin();
  const db = await getDb();
  await db.delete(automations).where(eq(automations.id, id));
  revalidatePath('/automations');
  redirect('/automations?ok=Automation%20gel%C3%B6scht');
}
