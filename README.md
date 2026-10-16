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

`DATABASE_URL` aus Supabase: **Connect → Connection string → Session pooler** (Port 5432, funktioniert mit IPv4). Das Passwort wird dort eingesetzt; Sonderzeichen im Passwort müssen URL-kodiert sein (`@` → `%40`).

## Live schalten auf Railway (ca. 5 €/Monat)

1. Den Code in ein privates GitHub-Repository legen.
2. Auf railway.com ein neues Projekt anlegen: **Deploy from GitHub repo**. Eine Railway-Datenbank ist nicht nötig.
3. Beim App-Dienst unter **Variables** eintragen:
   - `DATABASE_URL` → Supabase Session-Pooler-Adresse (siehe oben)
   - `APP_URL` → die Railway-Adresse (Settings → Networking → Generate Domain)
   - `ADMIN_PASSWORD`, `SESSION_SECRET`, `ENCRYPTION_KEY`, `CRON_SECRET`, `WEBHOOK_VERIFY_TOKEN` → neue Zufallswerte (`openssl rand -hex 32`)
   - `IG_APP_ID`, `IG_APP_SECRET` → aus dem Meta-Dashboard
   - `GRAPH_VERSION=v26.0`
4. Deploy: Migrationen laufen automatisch vor jedem Start (`railway.json`).
5. **Meta-Dashboard** → API-Einrichtung mit Instagram-Login → Webhooks:
   - Callback-URL: `APP_URL/api/webhooks/instagram`
   - Verifizierungstoken: `WEBHOOK_VERIFY_TOKEN`
6. **Instagram verbinden**: In der App unter Einstellungen den Token aus dem Meta-Dashboard einfügen. Beim Verbinden abonniert die App das Konto automatisch für `comments`, `messages` und `messaging_postbacks`.
7. **Cron-Dienst**: **+ New → GitHub repo** (dasselbe Repo), Start Command `npm run cron`, Cron Schedule `0 3 * * *`, Variablen `APP_URL` und `CRON_SECRET`. Er erneuert den Instagram-Zugang vor Ablauf (60 Tage) und räumt alte Daten auf.

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
