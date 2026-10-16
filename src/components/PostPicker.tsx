'use client';

import { useRef } from 'react';
import { Check, Film, ImageOff, X } from 'lucide-react';
import type { IgMedia } from '@/lib/instagram/client';
import { Button, cx } from './ui';

export function PostPicker({ media, selectedId, fallback, onSelect, error }: {
  media: IgMedia[] | null; selectedId?: string; fallback?: IgMedia; onSelect: (m: IgMedia) => void; error?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const selected = media?.find((m) => m.id === selectedId) ?? (fallback?.id === selectedId ? fallback : undefined);

  return (
    <div>
      <div className="flex items-center gap-3">
        {selectedId ? (
          <>
            <Thumb m={selected} className="size-14 rounded-md" />
            <div className="min-w-0 flex-1 text-sm">
              <p className="truncate font-semibold">{selected?.caption?.slice(0, 80) || 'Ausgewählter Beitrag'}</p>
              {selected?.timestamp && <p className="text-xs text-muted">{new Date(selected.timestamp).toLocaleDateString('de-DE')}</p>}
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={() => ref.current?.showModal()}>Ändern</Button>
          </>
        ) : (
          <Button type="button" variant="secondary" onClick={() => ref.current?.showModal()} aria-describedby="mediaId-msg">Beitrag auswählen</Button>
        )}
      </div>
      {error && <p id="mediaId-msg" className="mt-1.5 text-xs font-medium text-danger">{error}</p>}

      <dialog ref={ref} aria-labelledby="picker-title" className="m-auto w-[min(720px,calc(100vw-32px))] rounded-lg bg-bg p-0 shadow-pop">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 id="picker-title" className="font-semibold">Beitrag auswählen</h2>
          <button type="button" aria-label="Schließen" onClick={() => ref.current?.close()} className="rounded-md p-1 hover:bg-surface">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">
          {media === null ? (
            <p className="text-sm text-muted">Verbinde zuerst dein Instagram-Konto unter Einstellungen, dann erscheinen hier deine Beiträge.</p>
          ) : media.length === 0 ? (
            <p className="text-sm text-muted">Keine Beiträge gefunden.</p>
          ) : (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {media.map((m) => {
                const active = m.id === selectedId;
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => { onSelect(m); ref.current?.close(); }}
                      aria-pressed={active}
                      aria-label={m.caption ? m.caption.slice(0, 80) : `Beitrag vom ${m.timestamp ? new Date(m.timestamp).toLocaleDateString('de-DE') : ''}`}
                      className={cx('relative block w-full overflow-hidden rounded-md', active && 'ring-2 ring-accent ring-offset-2')}
                    >
                      <Thumb m={m} className="aspect-square w-full" />
                      {m.media_product_type === 'REELS' && <Film className="absolute top-1.5 right-1.5 size-4 text-white drop-shadow" aria-hidden />}
                      {active && (
                        <span className="absolute inset-0 grid place-items-center bg-accent/40" aria-hidden>
                          <Check className="size-8 text-white" />
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </dialog>
    </div>
  );
}

function Thumb({ m, className }: { m?: IgMedia; className?: string }) {
  const src = m?.thumbnail_url ?? (m?.media_type !== 'VIDEO' ? m?.media_url : undefined);
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={cx('object-cover', className)} loading="lazy" />
  ) : (
    <div className={cx('grid place-items-center bg-surface-2 text-muted', className)}><ImageOff className="size-5" aria-hidden /></div>
  );
}
