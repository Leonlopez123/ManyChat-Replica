'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings, Users, Zap } from 'lucide-react';
import { cx } from '@/components/ui';

const links = [
  { href: '/automations', label: 'Automationen', icon: Zap },
  { href: '/contacts', label: 'Kontakte', icon: Users },
  { href: '/settings', label: 'Einstellungen', icon: Settings },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav aria-label="Hauptnavigation" className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
      {links.map(({ href, label, icon: Icon }) => {
        const active = path === href || path.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cx(
              'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap',
              active ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface hover:text-fg',
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
