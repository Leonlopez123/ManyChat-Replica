import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { Users } from 'lucide-react';
import { getDb, rowsOf } from '@/lib/db';
import { automations, runStatuses, type RunStatus } from '@/lib/db/schema';
import { Badge, Card, EmptyState, Flash, PageHeader, StatusBadge, Table, dateFmt, statusLabel } from '@/components/ui';

interface Row {
  id: string; username: string | null; first_name: string | null; is_follower: boolean | null;
  last_status: RunStatus; automation_name: string; last_at: string; runs: string; clicks: string;
}

export default async function ContactsPage({ searchParams }: { searchParams: Promise<{ a?: string; s?: string; ok?: string }> }) {
  const { a, s, ok } = await searchParams;
  const db = await getDb();
  const autos = await db.select({ id: automations.id, name: automations.name }).from(automations).orderBy(automations.name);
  const autoFilter = autos.some((x) => x.id === a) ? a : undefined;
  const statusFilter = runStatuses.includes(s as RunStatus) ? (s as RunStatus) : undefined;

  const rows = rowsOf<Row>(
    await db.execute(sql`
      select c.id, c.username, c.first_name, c.is_follower,
        lr.status as last_status, au.name as automation_name, lr.created_at as last_at,
        (select count(*) from runs r2 where r2.contact_id = c.id) as runs,
        (select count(*) from link_clicks lc join runs r3 on r3.id = lc.run_id where r3.contact_id = c.id) as clicks
      from contacts c
      join lateral (
        select r.* from runs r where r.contact_id = c.id
        ${autoFilter ? sql`and r.automation_id = ${autoFilter}` : sql``}
        order by r.created_at desc limit 1
      ) lr on true
      join automations au on au.id = lr.automation_id
      ${statusFilter ? sql`where lr.status = ${statusFilter}` : sql``}
      order by lr.created_at desc
      limit 500`),
  );

  return (
    <>
      <PageHeader title="Kontakte" description="Alle, die ein Stichwort kommentiert haben." />
      <Flash ok={ok} />
      <form className="mb-4 flex flex-wrap items-end gap-3" aria-label="Filter">
        <label className="text-sm">
          <span className="mb-1 block font-semibold">Automation</span>
          <select name="a" defaultValue={autoFilter ?? ''} className="h-10 rounded-md border border-line-input bg-bg px-3 text-sm">
            <option value="">Alle</option>
            {autos.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-semibold">Status</span>
          <select name="s" defaultValue={statusFilter ?? ''} className="h-10 rounded-md border border-line-input bg-bg px-3 text-sm">
            <option value="">Alle</option>
            {runStatuses.map((st) => <option key={st} value={st}>{statusLabel[st][0]}</option>)}
          </select>
        </label>
        <button className="h-10 rounded-md border border-line bg-bg px-4 text-sm font-semibold hover:bg-surface">Filtern</button>
      </form>

      <Card className="p-0">
        {rows.length === 0 ? (
          <EmptyState icon={<Users className="size-5" />} title="Noch keine Kontakte" text="Sobald jemand ein Stichwort kommentiert, erscheint die Person hier." />
        ) : (
          <Table head={['Kontakt', 'Folgt dir', 'Letzte Automation', 'Status', 'Link-Klicks', 'Zuletzt']}>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3">
                  <Link href={`/contacts/${r.id}`} className="font-semibold hover:text-accent hover:underline">@{r.username ?? 'unbekannt'}</Link>
                  {r.first_name && <span className="block text-xs text-muted">{r.first_name}</span>}
                </td>
                <td className="px-4 py-3">{r.is_follower === null ? <span className="text-muted">–</span> : r.is_follower ? <Badge tone="success">Ja</Badge> : <Badge>Nein</Badge>}</td>
                <td className="px-4 py-3 text-muted">{r.automation_name}{+r.runs > 1 && <span className="text-xs"> (+{+r.runs - 1})</span>}</td>
                <td className="px-4 py-3"><StatusBadge status={r.last_status} /></td>
                <td className="px-4 py-3 tabular-nums">{r.clicks}</td>
                <td className="px-4 py-3 whitespace-nowrap text-muted">{dateFmt.format(new Date(r.last_at))}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
