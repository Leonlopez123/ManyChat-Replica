import { desc, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { events } from '@/lib/db/schema';
import { getAccount } from '@/lib/account';
import { env } from '@/lib/env';
import { Badge, Button, Card, Flash, LinkButton, PageHeader, dateFmt } from '@/components/ui';
import { disconnect, refreshNow, saveManualToken } from './actions';
import { TokenForm } from './TokenForm';
import { ConfirmButton } from '@/components/ConfirmButton';

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  const db = await getDb();
  const account = await getAccount(db);
  const errors = await db.select().from(events).where(eq(events.kind, 'api_error')).orderBy(desc(events.createdAt)).limit(50);
  const daysLeft = account ? Math.floor((account.tokenExpiresAt.getTime() - Date.now()) / 864e5) : 0;

  return (
    <>
      <PageHeader title="Einstellungen" />
      <Flash ok={ok} error={error} />
      <div className="space-y-6">
        <Card className="space-y-4">
          <h2 className="text-base font-semibold">Instagram-Konto</h2>
          {account ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="text-sm">
                <p>Verbunden mit <b>@{account.username}</b> <Badge tone="success">aktiv</Badge></p>
                <p className="mt-1 text-muted">
                  Zugang gültig bis {dateFmt.format(account.tokenExpiresAt)} ({daysLeft} Tage). Wird automatisch erneuert, wenn weniger als 10 Tage übrig sind.
                </p>
                {account.webhookSubscribedAt && <p className="text-muted">Benachrichtigungen abonniert seit {dateFmt.format(account.webhookSubscribedAt)}</p>}
              </div>
              <div className="flex gap-2">
                <form action={refreshNow}><Button variant="secondary" size="sm">Jetzt erneuern</Button></form>
                <form action={disconnect}><ConfirmButton variant="danger" size="sm" confirm="Konto trennen? Dabei werden auch alle Automationen, Kontakte und Statistiken gelöscht.">Trennen</ConfirmButton></form>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">Noch nicht verbunden.</p>
          )}
          <div className="flex flex-wrap gap-2 border-t border-line pt-4">
            <LinkButton href="/api/instagram/connect" prefetch={false}>{account ? 'Neu verbinden' : 'Mit Instagram verbinden'}</LinkButton>
          </div>
          <details className="text-sm">
            <summary className="cursor-pointer font-semibold text-accent">Oder Token aus dem Meta-Dashboard einfügen</summary>
            <p className="mt-2 mb-3 text-muted">
              Meta-Dashboard → Anwendungsfälle → Instagram API → API-Einrichtung mit Instagram-Login → „Token generieren“. Der Token wird verschlüsselt gespeichert.
            </p>
            <TokenForm action={saveManualToken} />
          </details>
        </Card>

        <Card className="space-y-3 text-sm">
          <h2 className="text-base font-semibold">Webhook (im Meta-Dashboard eintragen)</h2>
          <p><span className="text-muted">Callback-URL:</span> <code className="rounded bg-surface px-1.5 py-0.5">{env.appUrl}/api/webhooks/instagram</code></p>
          <p><span className="text-muted">Verifizierungstoken:</span> der Wert von <code className="rounded bg-surface px-1.5 py-0.5">WEBHOOK_VERIFY_TOKEN</code></p>
          <p><span className="text-muted">Felder:</span> comments, messages, messaging_postbacks</p>
          <p><span className="text-muted">Weiterleitungs-URI für „Mit Instagram verbinden“:</span> <code className="rounded bg-surface px-1.5 py-0.5">{env.appUrl}/api/instagram/callback</code></p>
        </Card>

        <Card className="p-0">
          <h2 className="px-6 pt-5 pb-3 text-base font-semibold">Fehlerprotokoll</h2>
          {errors.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted">Keine Fehler. 👍</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {errors.map((e) => {
                const p = e.payload as { step?: string; message?: string; code?: number };
                return (
                  <li key={e.id} className="px-6 py-3">
                    <p><b>{p.step ?? 'unbekannt'}</b>: {p.message}{p.code ? <span className="text-muted"> (Code {p.code})</span> : null}</p>
                    <p className="text-xs text-muted">{dateFmt.format(e.createdAt)}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
