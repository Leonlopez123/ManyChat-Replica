import Link from 'next/link';
import { asc } from 'drizzle-orm';
import { Plus, Zap } from 'lucide-react';
import { getDb } from '@/lib/db';
import { automations } from '@/lib/db/schema';
import { emptyFunnel, funnels } from '@/lib/queries';
import { Badge, Card, EmptyState, Flash, LinkButton, PageHeader, Table } from '@/components/ui';
import { ActiveToggle } from './ActiveToggle';

const scopeLabel = { single: 'Ein Beitrag', all: 'Alle Beiträge', next: 'Nächster Beitrag' } as const;

export default async function AutomationsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  const db = await getDb();
  const list = await db.select().from(automations).orderBy(asc(automations.createdAt));
  const stats = await funnels(db);

  return (
    <>
      <PageHeader
        title="Automationen"
        description="Wer ein Stichwort kommentiert, bekommt automatisch eine DM."
        actions={<LinkButton href="/automations/new"><Plus className="size-4" aria-hidden /> Neue Automation</LinkButton>}
      />
      <Flash ok={ok} error={error} />
      <Card className="p-0">
        {list.length === 0 ? (
          <EmptyState
            icon={<Zap className="size-5" />}
            title="Noch keine Automation"
            text="Leg die erste an: Beitrag wählen, Stichwort festlegen, Nachrichten schreiben."
            action={<LinkButton href="/automations/new">Erste Automation anlegen</LinkButton>}
          />
        ) : (
          <Table head={['Aktiv', 'Name', 'Stichwörter', 'Beitrag', 'Kommentare', 'Geliefert', 'Link geöffnet']}>
            {list.map((a) => {
              const f = stats.get(a.id) ?? emptyFunnel;
              const pct = (n: number) => (f.comments ? ` · ${Math.round((n / f.comments) * 100)} %` : '');
              return (
                <tr key={a.id}>
                  <td className="px-4 py-3"><ActiveToggle id={a.id} active={a.active} name={a.name} /></td>
                  <td className="px-4 py-3 font-semibold">
                    <Link href={`/automations/${a.id}`} className="hover:text-accent hover:underline">{a.name}</Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">{a.keywords.map((k) => <Badge key={k}>{k}</Badge>)}</div>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {a.postScope === 'single' && a.mediaPermalink ? (
                      <a href={a.mediaPermalink} target="_blank" rel="noreferrer" className="hover:underline">{scopeLabel.single}</a>
                    ) : a.postScope === 'next' && a.mediaId ? 'Nächster (gebunden)' : scopeLabel[a.postScope]}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{f.comments}</td>
                  <td className="px-4 py-3 tabular-nums">{f.delivered}<span className="text-muted">{pct(f.delivered)}</span></td>
                  <td className="px-4 py-3 tabular-nums">{f.linkClicked}<span className="text-muted">{pct(f.linkClicked)}</span></td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
    </>
  );
}
