'use client';

import { useActionState, useState } from 'react';
import { DEFAULTS } from '@/lib/automationDefaults';
import type { IgMedia } from '@/lib/instagram/client';
import { saveAutomation, type FormState } from '@/app/(dash)/automations/actions';
import { Button, Card, Field, Flash, Input, Textarea, cx } from './ui';
import { Toggle } from './Toggle';
import { KeywordInput } from './KeywordInput';
import { PostPicker } from './PostPicker';
import { PhonePreview } from './PhonePreview';

type Values = typeof DEFAULTS;

const scopes = [
  { v: 'single', label: 'Bestimmter Beitrag', hint: 'Nur Kommentare unter einem ausgewählten Post oder Reel.' },
  { v: 'next', label: 'Nächster Beitrag', hint: 'Greift beim ersten Post, den du nach dem Aktivieren veröffentlichst.' },
  { v: 'all', label: 'Alle Beiträge', hint: 'Jeder Post. Automationen für einen bestimmten Beitrag haben Vorrang.' },
] as const;

export function AutomationForm({ id, initial, media }: { id: string | null; initial: Values; media: IgMedia[] | null }) {
  const [v, setV] = useState<Values>(initial);
  const set = <K extends keyof Values>(k: K, val: Values[K]) => setV((p) => ({ ...p, [k]: val }));
  const [state, action, pending] = useActionState<FormState, FormData>(saveAutomation.bind(null, id), { errors: {} });
  const e = state.errors;

  const text = (k: keyof Values, label: string, opts: { hint?: string; max?: number; area?: boolean; placeholder?: string } = {}) => {
    const val = String(v[k] ?? '');
    const props = {
      id: k, name: k, value: val, placeholder: opts.placeholder, invalid: !!e[k],
      onChange: (ev: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, ev.target.value as never),
    };
    return (
      <Field label={label} htmlFor={k} hint={opts.hint} error={e[k]}
        counter={opts.max ? <span className={cx('text-xs tabular-nums', val.length > opts.max ? 'text-danger' : 'text-muted')}>{val.length}/{opts.max}</span> : undefined}>
        {opts.area ? <Textarea {...props} /> : <Input {...props} />}
      </Field>
    );
  };

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        {state.message && <Flash error={state.message} />}

        <Card className="space-y-5">
          <SectionTitle n={1} title="Auslöser" />
          {text('name', 'Name (nur für dich)', { placeholder: 'z. B. Kita-Leitfaden' })}
          <fieldset className="space-y-2">
            <legend className="mb-1.5 text-sm font-semibold">Welche Beiträge?</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {scopes.map((s) => (
                <label key={s.v} className={cx('cursor-pointer rounded-md border p-3 text-sm', v.postScope === s.v ? 'border-accent bg-accent-soft' : 'border-line hover:bg-surface')}>
                  <input type="radio" name="postScope" value={s.v} checked={v.postScope === s.v} onChange={() => set('postScope', s.v)} className="sr-only" />
                  <span className="block font-semibold">{s.label}</span>
                  <span className="mt-0.5 block text-xs text-muted">{s.hint}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {v.postScope === 'single' && (
            <>
              <PostPicker
                media={media}
                selectedId={v.mediaId || undefined}
                fallback={v.mediaId ? { id: v.mediaId, thumbnail_url: v.mediaThumbnailUrl || undefined, permalink: v.mediaPermalink } : undefined}
                error={e.mediaId}
                onSelect={(m) => setV((p) => ({ ...p, mediaId: m.id, mediaPermalink: m.permalink ?? '', mediaThumbnailUrl: m.thumbnail_url ?? m.media_url ?? '' }))}
              />
              <input type="hidden" name="mediaId" value={v.mediaId} />
              <input type="hidden" name="mediaPermalink" value={v.mediaPermalink} />
              <input type="hidden" name="mediaThumbnailUrl" value={v.mediaThumbnailUrl} />
            </>
          )}
          <Field label="Stichwörter" htmlFor="kw" error={e.keywords} hint="Enter oder Komma zum Hinzufügen. Groß/klein und Satzzeichen egal; „kita“ trifft auch „Kitas“.">
            <KeywordInput id="kw" name="keywords" value={v.keywords} onChange={(k) => set('keywords', k)} placeholder="z. B. kita" invalid={!!e.keywords} />
          </Field>
          <Field label="Ausschluss-Wörter (optional)" htmlFor="ex" hint="Kommentare mit diesen Wörtern lösen nichts aus, z. B. „kitaplatz“.">
            <KeywordInput id="ex" name="excludeKeywords" value={v.excludeKeywords} onChange={(k) => set('excludeKeywords', k)} />
          </Field>
        </Card>

        <Card className="space-y-5">
          <SectionTitle n={2} title="Öffentliche Antwort unter dem Kommentar" hint="Bis zu 3 Varianten, wir wechseln zufällig. Alle leer = keine öffentliche Antwort." />
          {[0, 1, 2].map((i) => (
            <Field key={i} label={`Variante ${i + 1}`} htmlFor={`pr${i}`} error={i === 0 ? e.publicReplies : undefined}>
              <Input id={`pr${i}`} name="publicReplies" value={v.publicReplies[i] ?? ''} maxLength={300}
                onChange={(ev) => set('publicReplies', v.publicReplies.map((x, j) => (j === i ? ev.target.value : x)))} />
            </Field>
          ))}
        </Card>

        <Card className="space-y-5">
          <SectionTitle n={3} title="Erste DM" hint="Geht als private Antwort auf den Kommentar raus. {{vorname}} wird hier durch den Instagram-Namen ersetzt." />
          {text('openingText', 'Nachricht', { area: true, max: 640 })}
          {text('openingButtonLabel', 'Button', { max: 20 })}
        </Card>

        <Card className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <SectionTitle n={4} title="Follow-Check" hint="Nach dem Tippen auf den Button prüfen wir, ob die Person dir folgt." />
            <Toggle checked={v.followGate} onChange={(x) => set('followGate', x)} label="Follow-Check an oder aus" />
            {v.followGate && <input type="hidden" name="followGate" value="on" />}
          </div>
          {v.followGate && (
            <>
              {text('followPromptText', 'Nachricht, wenn noch nicht gefolgt', { area: true, max: 640 })}
              {text('followButtonLabel', 'Button', { max: 20 })}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Wie oft nachfragen?" htmlFor="maxFollowAttempts" error={e.maxFollowAttempts}>
                  <Input id="maxFollowAttempts" name="maxFollowAttempts" type="number" min={1} max={10} value={v.maxFollowAttempts}
                    onChange={(ev) => set('maxFollowAttempts', Number(ev.target.value))} />
                </Field>
                <label className="flex items-start gap-2 pt-7 text-sm">
                  <input type="checkbox" name="deliverWhenGateExhausted" checked={v.deliverWhenGateExhausted}
                    onChange={(ev) => set('deliverWhenGateExhausted', ev.target.checked)} className="mt-0.5 size-4 accent-[var(--color-accent)]" />
                  Danach trotzdem schicken <span className="text-muted">(empfohlen, wirkt weniger wie Spam)</span>
                </label>
              </div>
            </>
          )}
          {!v.followGate && (
            <>
              <input type="hidden" name="followPromptText" value={v.followPromptText} />
              <input type="hidden" name="followButtonLabel" value={v.followButtonLabel} />
              <input type="hidden" name="maxFollowAttempts" value={v.maxFollowAttempts} />
              {v.deliverWhenGateExhausted && <input type="hidden" name="deliverWhenGateExhausted" value="on" />}
            </>
          )}
        </Card>

        <Card className="space-y-5">
          <SectionTitle n={5} title="Lead-Magnet" hint="Kommt nach dem Klick (und bestandenem Follow-Check). {{vorname}} = echter Vorname, falls bekannt." />
          {text('deliveryText', 'Nachricht', { area: true, max: 640 })}
          {text('deliveryUrl', 'Link zum Lead-Magneten', { placeholder: 'https://…', hint: 'PDF, Seite oder Video. Klicks werden gezählt.' })}
          {text('deliveryButtonLabel', 'Button', { max: 20 })}
        </Card>

        <Card className="space-y-5">
          <SectionTitle n={6} title="Zweiter Lead-Magnet (optional)" hint="Direkt danach als eigene Nachricht. Text und Link leer lassen, um ihn wegzulassen." />
          {text('bonusText', 'Nachricht', { area: true, max: 640 })}
          {text('bonusUrl', 'Link', { placeholder: 'https://…' })}
          {text('bonusButtonLabel', 'Button', { max: 20 })}
        </Card>

        <Card className="flex flex-wrap items-center justify-between gap-4">
          <label className="flex items-center gap-3 text-sm font-semibold">
            <Toggle checked={v.active} onChange={(x) => set('active', x)} label="Automation aktiv" />
            {v.active ? 'Aktiv – reagiert auf neue Kommentare' : 'Pausiert'}
          </label>
          {v.active && <input type="hidden" name="active" value="on" />}
          <Button type="submit" loading={pending}>Speichern</Button>
        </Card>
      </div>

      <div className="lg:sticky lg:top-8 lg:self-start">
        <p className="mb-3 text-center text-xs font-semibold text-muted">Vorschau</p>
        <PhonePreview
          d={{
            keyword: v.keywords[0] ?? '',
            publicReply: v.publicReplies.find(Boolean),
            openingText: v.openingText,
            openingButtonLabel: v.openingButtonLabel,
            followGate: v.followGate,
            followPromptText: v.followPromptText,
            followButtonLabel: v.followButtonLabel,
            deliveryText: v.deliveryText,
            deliveryButtonLabel: v.deliveryButtonLabel,
            bonusText: v.bonusText && v.bonusUrl ? v.bonusText : undefined,
            bonusButtonLabel: v.bonusButtonLabel,
          }}
        />
      </div>
    </form>
  );
}

function SectionTitle({ n, title, hint }: { n: number; title: string; hint?: string }) {
  return (
    <div>
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <span className="grid size-6 place-items-center rounded-full bg-accent-soft text-xs text-accent" aria-hidden>{n}</span>
        {title}
      </h2>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
    </div>
  );
}
