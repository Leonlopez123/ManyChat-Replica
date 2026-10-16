import Link from 'next/link';
import { notFound } from 'next/navigation';
import { asc, eq, inArray } from 'drizzle-orm';
import { Trash2 } from 'lucide-react';
import { getDb } from '@/lib/db';
import { automations, contacts, events, linkClicks, runs } from '@/lib/db/schema';
import { ConfirmButton } from '@/components/ConfirmButton';
import { Badge, Card, PageHeader, StatusBadge, dateFmt } from '@/components/ui';
import { deleteContact } from './actions';

const UUID = /^[0-9a-f-]{36}$/;

const stepLabel: Record<string, string> = {
  opening: 'Erste DM gesendet',
  follow_prompt: 'Follow-Aufforderung gesendet',
  delivery: 'Lead-Magnet gesendet',
  bonus: 'Zweiten Lead-Magneten gesendet',
};

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const db = await getDb();
  const [c] = await db.select().from(contacts).where(eq(contacts.id, id));
  if (!c) notFound();

  const runRows = await db
    .select({ run: runs, automationName: automations.name })
    .from(runs)
    .innerJoin(automations, eq(automations.id, runs.automationId))
    .where(eq(runs.contactId, c.id))
    .orderBy(asc(runs.createdAt));
  const runIds = runRows.map((r) => r.run.id);
  const [evts, clicks] = runIds.length
    ? await Promise.all([
        db.select().from(events).where(inArray(events.runId, runIds)).orderBy(asc(events.createdAt)),
        db.select().from(linkClicks).where(inArray(linkClicks.runId, runIds)).orderBy(asc(linkClicks.clickedAt)),
      ])
    : [[], []];

  return (
    <>
      <PageHeader
        title={`@${c.username ?? 'unbekannt'}`}
        description={<Link href="/contacts" className="hover:underline">← Alle Kontakte</Link>}
        actions={
          <form action={deleteContact.bind(null, c.id)}>
            <ConfirmButton variant="danger" size="sm" confirm="Alle Daten dieses Kontakts endgültig löschen?"><Trash2 className="size-4" aria-hidden /> Daten löschen</ConfirmButton>
          </form>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="space-y-3 self-start text-sm">
          <Info label="Name">{c.firstName ?? '–'}</Info>
          <Info label="Folgt dir">
            {c.isFollower === null ? '–' : c.isFollower ? <Badge tone="success">Ja</Badge> : <Badge>Nein</Badge>}
            {c.followerCheckedAt && <span className="ml-2 text-xs text-muted">geprüft {dateFmt.format(c.followerCheckedAt)}</span>}
          </Info>
          <Info label="Erster Kontakt">{dateFmt.format(c.createdAt)}</Info>
          <Info label="Letzte Nachricht von ihr/ihm">{c.lastInteractionAt ? dateFmt.format(c.lastInteractionAt) : '–'}</Info>
          {c.username && (
            <a href={`https://instagram.com/${c.username}`} target="_blank" rel="noreferrer" className="inline-block font-semibold text-accent hover:underline">
              Profil auf Instagram öffnen
            </a>
          )}
        </Card>

        <div className="space-y-6">
          {runRows.map(({ run, automationName }) => (
            <Card key={run.id}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">{automationName}</h2>
                <StatusBadge status={run.status} />
              </div>
              <ol className="space-y-3 border-l-2 border-line pl-4 text-sm">
                <Step at={run.createdAt}>Kommentar: „{run.commentText}“</Step>
                {evts
                  .filter((e) => e.runId === run.id && (e.kind === 'send' || e.kind === 'api_error' || e.kind === 'webhook_postback'))
                  .map((e) => {
                    const p = e.payload as { step?: string; message?: string; attempt?: number };
                    if (e.kind === 'api_error') return <Step key={e.id} at={e.createdAt} danger>Fehler bei {p.step}: {p.message}</Step>;
                    if (e.kind === 'webhook_postback') return <Step key={e.id} at={e.createdAt}>Auf Button getippt</Step>;
                    return <Step key={e.id} at={e.createdAt}>{stepLabel[p.step ?? ''] ?? p.step}{p.attempt ? ` (${p.attempt}.)` : ''}</Step>;
                  })}
                {clicks.filter((k) => k.runId === run.id).map((k) => (
                  <Step key={k.id} at={k.clickedAt}>{k.target === 'bonus' ? 'Website-Link geöffnet' : 'Lead-Magnet geöffnet'}</Step>
                ))}
              </ol>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted">{label}</p>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

function Step({ at, children, danger }: { at: Date; children: React.ReactNode; danger?: boolean }) {
  return (
    <li className="relative">
      <span className={`absolute top-1.5 -left-[21px] size-2.5 rounded-full ${danger ? 'bg-danger' : 'bg-accent'}`} aria-hidden />
      <p className={danger ? 'text-danger' : ''}>{children}</p>
      <p className="text-xs text-muted">{dateFmt.format(at)}</p>
    </li>
  );
}
