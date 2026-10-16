# Kommentar-DM

Eigenes Comment-to-DM-Tool für @teamfinanzblick: Wer unter einem Beitrag ein Stichwort kommentiert, bekommt automatisch eine DM mit Button. Nach dem Tippen prüft das Tool, ob die Person dir folgt, und schickt dann den Lead-Magneten plus optional einen zweiten Link.

Läuft über die offizielle Instagram-API (Standard Access, keine App-Prüfung nötig, siehe `spike-meta.md`).

## Lokal starten

```bash
npm install
cp .env.example .env        # Werte ausfüllen (Zufallswerte: openssl rand -hex 32)
npm run migrate
npm run seed:demo           # optional: Beispieldaten zum Durchklicken
npm run dev
```

Öffnen: http://localhost:3000, Login mit `ADMIN_PASSWORD`.
Lokal nutzt die App eine eingebaute Datenbank (`DATABASE_URL=pglite:./.data/db`), Postgres ist nicht nötig.

```bash
npm test          # 31 Tests: Ablauf, Doppelversand, Follow-Check, Trigger-Auswahl, Statistik
npm run typecheck
```

## Datenbank: Supabase (Schema `kommentar_dm`)

Alle Tabellen liegen im eigenen Schema `kommentar_dm` im Supabase-Projekt des CRM. Die App legt Schema und Tabellen beim ersten Start selbst an und berührt nichts anderes. Das Schema ist nicht über Supabases öffentliche API erreichbar, solange du es dort nicht unter **Settings → API → Exposed schemas** einträgst (nicht tun).

`DATABASE_URL` aus Supabase: **Connect → Connection string**. Für Vercel den **Transaction pooler** (Port 6543), für einen dauerhaft laufenden Server (Railway) den **Session pooler** (Port 5432); beide funktionieren mit IPv4. Das Passwort wird dort eingesetzt; Sonderzeichen im Passwort müssen URL-kodiert sein (`@` → `%40`).

## Live schalten auf Vercel

Hinweis: Der Gratis-Tarif (Hobby) ist laut Vercel für nicht-kommerzielle Nutzung gedacht. Geschäftliche Nutzung ist dort formal nicht vorgesehen; wer sicher gehen will, nimmt Pro oder Railway.

1. Auf vercel.com **Add New → Project**, das GitHub-Repo importieren (Framework: Next.js, wird erkannt).
2. Unter **Environment Variables** eintragen (für Production):
   - `DATABASE_URL` → Supabase **Transaction pooler** (Port **6543**), mit Passwort
   - `APP_URL` → die Vercel-Adresse (nach dem ersten Deploy unter Domains; danach neu deployen)
   - `ADMIN_PASSWORD`, `SESSION_SECRET`, `ENCRYPTION_KEY`, `CRON_SECRET`, `WEBHOOK_VERIFY_TOKEN` → Zufallswerte (`openssl rand -hex 32`)
   - `IG_APP_ID`, `IG_APP_SECRET` → aus dem Meta-Dashboard
   - `GRAPH_VERSION=v26.0`
3. Deploy. Der Build legt das Schema `kommentar_dm` an (`npm run build` ruft zuerst die Migration auf).
4. **Meta-Dashboard** → Webhooks: Callback-URL `APP_URL/api/webhooks/instagram`, Verifizierungstoken = `WEBHOOK_VERIFY_TOKEN`.
5. In der App unter Einstellungen den Instagram-Token einfügen. Das Konto wird dabei für `comments`, `messages` und `messaging_postbacks` abonniert.
6. Cron läuft über `vercel.json` (täglich 03:00 UTC: Token erneuern, 03:30 aufräumen). Vercel sendet `CRON_SECRET` automatisch mit.

Alternativ Railway (ca. 5 $/Monat): gleiche Variablen, `DATABASE_URL` wie oben, Start über `railway.json`, Cron-Dienst mit `npm run cron`.

## Aufbau

| Pfad | Inhalt |
| --- | --- |
| `src/lib/engine/` | Kern-Ablauf ohne Framework: Kommentar → DM → Klick → Follow-Check → Lieferung |
| `src/lib/instagram/client.ts` | Aufrufe der Instagram-API (mit Wiederholung bei Rate-Limits) |
| `src/app/api/webhooks/instagram` | Webhook: Signatur prüfen, sofort 200, danach verarbeiten |
| `src/app/r/[runId]/[target]` | Klick-Zählung und Weiterleitung zum Lead-Magneten |
| `src/app/(dash)/` | Dashboard: Automationen, Kontakte, Einstellungen, `/design` (Bausteine) |
| `db/migrations/` | SQL-Schema (Quelle der Wahrheit) |
| `replica/` | Recon, Architektur, Design-Tokens, Feature-Liste |
| `spike/` | Testserver vom Meta-Test (wird nach dem Live-Gang nicht mehr gebraucht) |

## Grenzen (von Instagram vorgegeben)

- Eine automatische DM pro Kommentar, innerhalb von 7 Tagen. Wer nie auf den Button tippt, bekommt nichts weiter.
- Nach dem Tippen bleiben 24 Stunden für weitere Nachrichten.
- Pro Person und Beitrag läuft die Automation nur einmal.
- Höchstens 750 automatische Antworten pro Stunde. Kommentare unter Anzeigen aus dem Werbeanzeigenmanager funktionieren nicht.
