'use client';

import { useOptimistic, useTransition } from 'react';
import { Toggle } from '@/components/Toggle';
import { toggleAutomation } from './actions';

export function ActiveToggle({ id, active, name }: { id: string; active: boolean; name: string }) {
  const [pending, start] = useTransition();
  const [value, setValue] = useOptimistic(active);
  return (
    <Toggle
      checked={value}
      disabled={pending}
      label={`${name} ${value ? 'deaktivieren' : 'aktivieren'}`}
      onChange={(v) => start(async () => { setValue(v); await toggleAutomation(id, v); })}
    />
  );
}
