'use client';

import { cx } from './ui';

export function Toggle({ checked, onChange, label, disabled, id }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean; id?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-150 disabled:opacity-50',
        checked ? 'bg-accent' : 'bg-line-input',
      )}
    >
      <span className={cx('inline-block size-5 rounded-full bg-bg shadow-card transition-transform duration-150', checked ? 'translate-x-5.5' : 'translate-x-0.5')} />
    </button>
  );
}
