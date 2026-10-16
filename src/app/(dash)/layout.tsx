import { MessageCircleHeart } from 'lucide-react';
import { requireAdmin } from '@/lib/session';
import { getAccount } from '@/lib/account';
import { logout } from '@/app/login/actions';
import { Nav } from './Nav';

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const account = await getAccount();
  const daysLeft = account ? Math.floor((account.tokenExpiresAt.getTime() - Date.now()) / 864e5) : null;

  return (
    <div className="min-h-dvh md:flex">
      <aside className="border-b border-line bg-bg md:fixed md:inset-y-0 md:w-60 md:border-r md:border-b-0">
        <div className="flex h-14 items-center gap-2.5 px-5">
          <div className="grid size-8 place-items-center rounded-md bg-accent text-on-accent" aria-hidden>
            <MessageCircleHeart className="size-4" />
          </div>
          <span className="font-semibold">Kommentar-DM</span>
        </div>
        <Nav />
        <div className="hidden px-5 pt-6 text-xs text-muted md:block">
          {account ? <>Verbunden mit <span className="font-semibold text-fg">@{account.username}</span></> : 'Kein Instagram-Konto verbunden'}
          <form action={logout} className="mt-3">
            <button className="font-semibold text-accent hover:underline">Abmelden</button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 md:pl-60">
        <div className="mx-auto max-w-[1120px] px-4 py-8 md:px-8">
          {!account && (
            <Banner tone="warning">
              Noch kein Instagram-Konto verbunden. <a href="/settings" className="font-semibold underline">Jetzt verbinden</a>
            </Banner>
          )}
          {account && daysLeft !== null && daysLeft < 7 && (
            <Banner tone="danger">
              Der Instagram-Zugang läuft in {Math.max(daysLeft, 0)} Tagen ab. <a href="/settings" className="font-semibold underline">Jetzt erneuern</a>
            </Banner>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}

function Banner({ tone, children }: { tone: 'warning' | 'danger'; children: React.ReactNode }) {
  return (
    <div role="status" className={tone === 'danger' ? 'mb-6 rounded-md bg-danger-soft px-4 py-3 text-sm text-danger' : 'mb-6 rounded-md bg-warning-soft px-4 py-3 text-sm text-warning'}>
      {children}
    </div>
  );
}
