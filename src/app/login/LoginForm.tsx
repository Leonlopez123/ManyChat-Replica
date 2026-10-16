'use client';

import { useActionState } from 'react';
import { Button, Field, Input } from '@/components/ui';
import { login } from './actions';

export function LoginForm() {
  const [state, action, pending] = useActionState(login, { error: '' });
  return (
    <form action={action} className="space-y-4">
      <Field label="Passwort" htmlFor="password" error={state.error || undefined}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required autoFocus invalid={!!state.error} />
      </Field>
      <Button type="submit" className="w-full" loading={pending}>Anmelden</Button>
    </form>
  );
}
