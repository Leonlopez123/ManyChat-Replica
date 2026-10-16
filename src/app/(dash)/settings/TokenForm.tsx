'use client';

import { useActionState } from 'react';
import { Button, Field, Input } from '@/components/ui';

export function TokenForm({ action }: { action: (prev: { error: string }, f: FormData) => Promise<{ error: string }> }) {
  const [state, run, pending] = useActionState(action, { error: '' });
  return (
    <form action={run} className="flex flex-wrap items-end gap-3">
      <div className="min-w-64 flex-1">
        <Field label="Zugriffstoken" htmlFor="token" error={state.error || undefined}>
          <Input id="token" name="token" type="password" autoComplete="off" required invalid={!!state.error} />
        </Field>
      </div>
      <Button type="submit" variant="secondary" loading={pending}>Speichern</Button>
    </form>
  );
}
