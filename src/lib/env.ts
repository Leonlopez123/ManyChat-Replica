import 'server-only';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Umgebungsvariable ${name} fehlt (siehe .env.example)`);
  return v;
}

export const env = {
  get databaseUrl() { return process.env.DATABASE_URL ?? 'pglite:./.data/db'; },
  get appUrl() { return (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, ''); },
  get adminPassword() { return required('ADMIN_PASSWORD'); },
  get sessionSecret() { return required('SESSION_SECRET'); },
  get encryptionKey() { return required('ENCRYPTION_KEY'); },
  get cronSecret() { return required('CRON_SECRET'); },
  get verifyToken() { return required('WEBHOOK_VERIFY_TOKEN'); },
  get igAppId() { return required('IG_APP_ID'); },
  get igAppSecret() { return required('IG_APP_SECRET'); },
  get graphVersion() { return process.env.GRAPH_VERSION ?? 'v26.0'; },
};
