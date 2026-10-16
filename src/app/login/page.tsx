import { redirect } from 'next/navigation';
import { MessageCircleHeart } from 'lucide-react';
import { getSession } from '@/lib/session';
import { LoginForm } from './LoginForm';

export default async function LoginPage() {
  if ((await getSession()).admin) redirect('/automations');
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm rounded-lg border border-line bg-bg p-8 shadow-card">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-md bg-accent text-on-accent" aria-hidden>
            <MessageCircleHeart className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Kommentar-DM</h1>
            <p className="text-xs text-muted">Team Finanzblick</p>
          </div>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
