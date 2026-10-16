'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { normalize } from '@/lib/engine/text';
import { cx } from './ui';

export function KeywordInput({ id, name, value, onChange, placeholder, invalid }: {
  id: string; name: string; value: string[]; onChange: (v: string[]) => void; placeholder?: string; invalid?: boolean;
}) {
  const [draft, setDraft] = useState('');
  const [note, setNote] = useState('');

  const add = () => {
    const kw = normalize(draft);
    if (!kw) return setDraft('');
    if (value.includes(kw)) setNote(`„${kw}“ ist schon drin`);
    else { onChange([...value, kw]); setNote(''); }
    setDraft('');
  };

  return (
    <div>
      <div
        className={cx(
          'flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border bg-bg px-2 py-1.5 focus-within:outline-2 focus-within:outline-accent',
          invalid ? 'border-danger' : 'border-line-input',
        )}
      >
        <ul className="contents">
          {value.map((k) => (
            <li key={k} className="inline-flex items-center gap-1 rounded-full bg-accent-soft py-0.5 pr-1 pl-2.5 text-xs font-semibold text-accent">
              {k}
              <button type="button" aria-label={`Stichwort ${k} entfernen`} onClick={() => onChange(value.filter((x) => x !== k))} className="rounded-full p-0.5 hover:bg-accent/10">
                <X className="size-3" aria-hidden />
              </button>
              <input type="hidden" name={name} value={k} />
            </li>
          ))}
        </ul>
        <input
          id={id}
          value={draft}
          placeholder={value.length ? '' : placeholder}
          aria-invalid={invalid || undefined}
          aria-describedby={`${id}-msg`}
          onChange={(e) => {
            if (e.target.value.endsWith(',')) { setDraft(e.target.value.slice(0, -1)); setTimeout(add); return; }
            setDraft(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); add(); }
            if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={add}
          className="h-7 min-w-24 flex-1 bg-transparent px-1 text-sm outline-none"
        />
      </div>
      {note && <p className="mt-1 text-xs text-muted" role="status">{note}</p>}
    </div>
  );
}
