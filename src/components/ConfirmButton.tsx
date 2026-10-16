'use client';

import type { ComponentProps } from 'react';
import { Button } from './ui';

/** Submit-Button mit Rückfrage für alles, was sich nicht rückgängig machen lässt. */
export function ConfirmButton({ confirm, ...p }: ComponentProps<typeof Button> & { confirm: string }) {
  return (
    <Button
      {...p}
      onClick={(e) => {
        if (!window.confirm(confirm)) e.preventDefault();
      }}
    />
  );
}
