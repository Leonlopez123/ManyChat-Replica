import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { CircleAlert, CircleCheck, Loader2 } from 'lucide-react';
import type { RunStatus } from '@/lib/db/schema';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

const variants = {
  primary: 'bg-accent text-on-accent hover:bg-accent-hover',
  secondary: 'bg-bg text-fg border border-line hover:bg-surface',
  ghost: 'text-fg hover:bg-surface',
  danger: 'bg-bg text-danger border border-line hover:bg-danger-soft',
};
const sizes = { sm: 'h-8 px-3 text-sm', md: 'h-10 px-4 text-sm' };

type BtnOpts = { variant?: keyof typeof variants; size?: keyof typeof sizes };
const btn = ({ variant = 'primary', size = 'md' }: BtnOpts, extra?: string) =>
  cx(
    'inline-flex items-center justify-center gap-2 rounded-md font-semibold whitespace-nowrap transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none',
    variants[variant],
    sizes[size],
    extra,
  );

export function Button({ variant, size, loading, className, children, ...p }: ComponentProps<'button'> & BtnOpts & { loading?: boolean }) {
  return (
    <button {...p} className={btn({ variant, size }, className)} aria-busy={loading || undefined} disabled={p.disabled || loading}>
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function LinkButton({ variant, size, className, ...p }: ComponentProps<typeof Link> & BtnOpts) {
  return <Link {...p} className={btn({ variant, size }, className)} />;
}

export function Card({ className, ...p }: ComponentProps<'div'>) {
  return <div {...p} className={cx('rounded-lg border border-line bg-bg p-6 shadow-card', className)} />;
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-[28px] leading-[34px] font-bold">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function Field({ label, htmlFor, hint, error, children, counter }: {
  label: string; htmlFor: string; hint?: ReactNode; error?: string; children: ReactNode; counter?: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="text-sm font-semibold">{label}</label>
        {counter}
      </div>
      {children}
      {error ? (
        <p id={`${htmlFor}-msg`} className="text-xs font-medium text-danger">{error}</p>
      ) : hint ? (
        <p id={`${htmlFor}-msg`} className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

const inputBase =
  'w-full rounded-md border border-line-input bg-bg px-3 text-sm text-fg placeholder:text-muted/80 focus-visible:outline-2 focus-visible:outline-accent aria-[invalid=true]:border-danger disabled:bg-surface';

export function Input({ className, invalid, ...p }: ComponentProps<'input'> & { invalid?: boolean }) {
  return <input {...p} aria-invalid={invalid || undefined} aria-describedby={p.id ? `${p.id}-msg` : undefined} className={cx(inputBase, 'h-10', className)} />;
}

export function Textarea({ className, invalid, ...p }: ComponentProps<'textarea'> & { invalid?: boolean }) {
  return <textarea {...p} aria-invalid={invalid || undefined} aria-describedby={p.id ? `${p.id}-msg` : undefined} className={cx(inputBase, 'min-h-24 py-2 leading-5', className)} />;
}

const badgeTones = {
  neutral: 'bg-surface-2 text-fg',
  accent: 'bg-accent-soft text-accent',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
};

export function Badge({ tone = 'neutral', children }: { tone?: keyof typeof badgeTones; children: ReactNode }) {
  return <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', badgeTones[tone])}>{children}</span>;
}

export const statusLabel: Record<RunStatus, [string, keyof typeof badgeTones]> = {
  commented: ['Kommentiert', 'neutral'],
  dm_sent: ['DM gesendet', 'accent'],
  clicked: ['Geklickt', 'accent'],
  follow_pending: ['Wartet auf Folgen', 'warning'],
  delivered: ['Geliefert', 'success'],
  failed: ['Fehler', 'danger'],
  expired: ['Abgelaufen', 'neutral'],
};

export function StatusBadge({ status }: { status: RunStatus }) {
  const [label, tone] = statusLabel[status];
  return <Badge tone={tone}>{label}</Badge>;
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-3 grid size-12 place-items-center rounded-full bg-accent-soft text-accent" aria-hidden>{icon}</div>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Flash({ ok, error }: { ok?: string; error?: string }) {
  if (!ok && !error) return null;
  return error ? (
    <div role="alert" className="mb-6 flex items-start gap-2 rounded-md border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> {error}
    </div>
  ) : (
    <div role="status" className="mb-6 flex items-start gap-2 rounded-md border border-success/30 bg-success-soft px-4 py-3 text-sm text-success">
      <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden /> {ok}
    </div>
  );
}

export interface FunnelData { comments: number; dmSent: number; clicked: number; delivered: number; linkClicked: number }

export function Funnel({ data }: { data: FunnelData }) {
  const steps: [string, number][] = [
    ['Kommentare', data.comments],
    ['DM gesendet', data.dmSent],
    ['Auf Button getippt', data.clicked],
    ['Geliefert', data.delivered],
    ['Link geöffnet', data.linkClicked],
  ];
  const top = Math.max(data.comments, 1);
  return (
    <dl className="space-y-3">
      {steps.map(([label, n]) => (
        <div key={label}>
          <div className="flex justify-between text-sm">
            <dt className="text-muted">{label}</dt>
            <dd className="font-semibold tabular-nums">
              {n} <span className="font-normal text-muted">· {data.comments ? Math.round((n / top) * 100) : 0} %</span>
            </dd>
          </div>
          <div className="mt-1 h-2 rounded-full bg-surface-2" aria-hidden>
            <div className="h-2 rounded-full bg-accent transition-[width] duration-200" style={{ width: `${(n / top) * 100}%` }} />
          </div>
        </div>
      ))}
    </dl>
  );
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-line text-xs text-muted">
            {head.map((h) => <th key={h} scope="col" className="px-4 py-3 font-semibold">{h}</th>)}
          </tr>
        </thead>
        <tbody className="[&>tr]:border-b [&>tr]:border-line [&>tr:last-child]:border-0 [&>tr:hover]:bg-surface">{children}</tbody>
      </table>
    </div>
  );
}

export const dateFmt = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin' });
