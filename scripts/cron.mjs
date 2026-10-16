// Railway-Cron-Dienst (täglich 03:00 UTC): Token erneuern und aufräumen.
// Braucht APP_URL und CRON_SECRET als Variablen.
const base = process.env.APP_URL?.replace(/\/$/, '');
if (!base || !process.env.CRON_SECRET) throw new Error('APP_URL und CRON_SECRET müssen gesetzt sein');
for (const job of ['refresh-token', 'cleanup']) {
  const res = await fetch(`${base}/api/cron/${job}`, { method: 'POST', headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } });
  console.log(job, res.status, await res.text());
  if (!res.ok) process.exitCode = 1;
}
