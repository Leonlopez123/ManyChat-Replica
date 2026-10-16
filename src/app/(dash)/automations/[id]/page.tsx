import Link from 'next/link';
import { notFound } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { Trash2 } from 'lucide-react';
import { getDb } from '@/lib/db';
import { automations, contacts, runs } from '@/lib/db/schema';
import { emptyFunnel, funnels } from '@/lib/queries';
import { fromAutomation } from '@/lib/automationDefaults';
import { AutomationForm } from '@/components/AutomationForm';
import { ConfirmButton } from '@/components/ConfirmButton';
import { Card, Flash, Funnel, PageHeader, StatusBadge, Table, dateFmt } from '@/components/ui';
import { deleteAutomation } from '../actions';
import { loadMedia } from '../media';

const UUID = /^[0-9a-f-]{36}$/;

export default async function AutomationPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const { ok, error } = await searchParams;
  if (!UUID.test(id)) notFound();
  const db = await getDb();
  const [a] = await db.select().from(automations).where(eq(automations.id, id));
  if (!a) notFound();

  const [stats, recent, media] = await Promise.all([
    funnels(db, a.id),
    db
      .select({ id: runs.id, status: runs.status, createdAt: runs.createdAt, error: runs.error, contactId: contacts.id, username: contacts.username, comment: runs.commentText })
      .from(runs)
      .innerJoin(contacts, eq(contacts.id, runs.contactId))
      .where(eq(runs.automationId, a.id))
      .orderBy(desc(runs.createdAt))
      .limit(10),
    loadMedia(),
  ]);

  return (
    <>
      <PageHeader
        title={a.name}
        description={<Link href="/automations" className="hover:underline">← Alle Automationen</Link>}
        actions={
          <form action={deleteAutomation.bind(null, a.id)}>
            <ConfirmButton variant="danger" size="sm" confirm="Automation mit allen Statistiken löschen?"><Trash2 className="size-4" aria-hidden /> Löschen</ConfirmButton>
          </form>
        }
      />
      <Flash ok={ok} error={error} />

      <div className="mb-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="p-0">
          <h2 className="px-6 pt-5 pb-2 text-base font-semibold">Letzte Kommentare</h2>
          {recent.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted">Noch keine Kommentare mit Stichwort.</p>
          ) : (
            <Table head={['Wer', 'Kommentar', 'Status', 'Wann']}>
              {recent.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-semibold"><Link href={`/contacts/${r.contactId}`} className="hover:text-accent hover:underline">@{r.username ?? '–'}</Link></td>
                  <td className="max-w-48 truncate px-4 py-3 text-muted">{r.comment}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} />{r.error && <p className="mt-1 max-w-56 truncate text-xs text-danger" title={r.error}>{r.error}</p>}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted">{dateFmt.format(r.createdAt)}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
        <Card>
          <h2 className="mb-4 text-base font-semibold">Trichter</h2>
          <Funnel data={stats.get(a.id) ?? emptyFunnel} />
        </Card>
      </div>

      <AutomationForm id={a.id} initial={fromAutomation(a)} media={media} />
    </>
  );
}
