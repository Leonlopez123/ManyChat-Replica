import { Zap } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Field, Flash, Funnel, Input, PageHeader, StatusBadge, Textarea } from '@/components/ui';
import { PhonePreview } from '@/components/PhonePreview';
import { DEFAULTS } from '@/lib/automationDefaults';
import { runStatuses } from '@/lib/db/schema';

// Design-System-Check: alle Grundbausteine mit ihren Zuständen auf einer Seite (nicht in der Navigation).
export default function DesignPage() {
  return (
    <>
      <PageHeader title="Design-System" description="Bausteine und Zustände. Tokens: replica/design/tokens.json" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <h2 className="font-semibold">Buttons</h2>
          <div className="flex flex-wrap gap-2">
            <Button>Primär</Button>
            <Button variant="secondary">Sekundär</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Löschen</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm">Klein</Button>
            <Button loading>Speichert</Button>
            <Button disabled>Deaktiviert</Button>
          </div>
        </Card>
        <Card className="space-y-4">
          <h2 className="font-semibold">Felder</h2>
          <Field label="Normal" htmlFor="d1" hint="Hinweistext"><Input id="d1" placeholder="Platzhalter" /></Field>
          <Field label="Fehler" htmlFor="d2" error="Bitte ausfüllen"><Input id="d2" invalid /></Field>
          <Field label="Mehrzeilig" htmlFor="d3"><Textarea id="d3" defaultValue="Hey {{vorname}} …" /></Field>
        </Card>
        <Card className="space-y-4">
          <h2 className="font-semibold">Badges</h2>
          <div className="flex flex-wrap gap-2">
            <Badge>neutral</Badge><Badge tone="accent">accent</Badge><Badge tone="success">success</Badge><Badge tone="warning">warning</Badge><Badge tone="danger">danger</Badge>
          </div>
          <div className="flex flex-wrap gap-2">{runStatuses.map((s) => <StatusBadge key={s} status={s} />)}</div>
          <Flash ok="Gespeichert" />
          <Flash error="Etwas ist schiefgelaufen" />
        </Card>
        <Card>
          <h2 className="mb-4 font-semibold">Trichter</h2>
          <Funnel data={{ comments: 120, dmSent: 118, clicked: 81, delivered: 74, linkClicked: 52 }} />
        </Card>
        <Card className="p-0">
          <EmptyState icon={<Zap className="size-5" />} title="Leerer Zustand" text="So sieht eine leere Liste aus." action={<Button>Aktion</Button>} />
        </Card>
        <Card>
          <PhonePreview d={{ ...DEFAULTS, keyword: 'kita', publicReply: DEFAULTS.publicReplies[0] }} />
        </Card>
      </div>
    </>
  );
}
