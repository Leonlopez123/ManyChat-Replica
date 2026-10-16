# Architecture: eigenes Comment-to-DM-Tool (Nachbau der ManyChat-Instagram-Kernfunktion)

Umfang: alle Muss- und Sollte-Zeilen aus `features.csv`. Single-Tenant: genau ein Admin (du) und ein Instagram-Professional-Account.

## Stack

| layer | choice | why |
| --- | --- | --- |
| web | Next.js 15 (App Router) + TypeScript | Dashboard und Webhook-Endpunkte in einer App |
| styling | Tailwind | schnell; Tokens kommen aus replica-design |
| database | Postgres auf Railway (gleiches Projekt wie die App) | eine Rechnung, schläft nicht ein, kein Kaltstart beim Webhook |
| ORM | Drizzle | dünn, SQL-nah, Migrationen aus `schema.sql` |
| auth | ein Admin-Passwort (bcrypt-Hash in ENV) + signiertes Session-Cookie (iron-session) | nur eine Person loggt sich ein; kein Auth-Anbieter nötig |
| Instagram | Instagram API mit Instagram Login (`graph.instagram.com`), Standard Access | offizielle API; für das eigene Konto ist keine App-Prüfung nötig (wird im Spike geprüft) |
| payments | keine | nicht im Umfang |
| email | keine | nicht im Umfang |
| jobs | Railway Cron → `POST /api/cron/*` mit `CRON_SECRET` | Token-Erneuerung, Aufräumen |
| hosting | Railway (Hobby, ca. 5 $/Monat inkl. Nutzung) | dauerhaft laufender Node-Prozess, HTTPS inklusive |

Warum nicht Vercel: Der Gratis-Tarif (Hobby) erlaubt keine kommerzielle Nutzung. Leads für dein Business gelten als kommerziell, und der Pro-Tarif kostet 20 $/Monat.
Laufende Kosten damit: **ca. 5–8 €/Monat**. Die Meta-API selbst ist kostenlos.

## Schema

Tables: 6 (`account`, `automations`, `contacts`, `runs`, `events`, `link_clicks`). Access rules: Prüfung im Data-Layer, keine RLS.
Jede Dashboard-Seite und jede Server-Action ruft zuerst `requireAdmin()` auf. Die öffentlichen Routen sind Webhook, Redirect und Cron. Der Webhook prüft die Signatur, der Redirect schreibt nur Klicks, Cron verlangt ein Secret.

Siehe `replica/schema.sql`. Gegen Postgres (PGlite) getestet: Nur ein Account möglich, kein zweiter Run pro User und Post, eine Single-Post-Automation braucht einen Post.

Harte Regeln liegen in der Datenbank, nicht in der Oberfläche:
- `runs.comment_id unique`: Ein Kommentar startet höchstens einen Ablauf, auch wenn Meta den Webhook zweimal schickt.
- `runs (automation_id, contact_id, media_id) unique`: wie bei ManyChat nur ein Durchlauf pro User und Post.
- `events.dedupe_key unique`: Postbacks und Nachrichten, die doppelt zugestellt werden, werden ignoriert.

## API

### F01 Automation einrichten (Dashboard, nur Admin)

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| GET /login, POST action `login` | Admin-Login | öffentlich, Rate-Limit 5/min | Passwort | Session-Cookie | – |
| POST action `logout` | Session löschen | Admin | – | Redirect /login | – |
| GET /api/instagram/connect | Redirect zu `instagram.com/oauth/authorize` (Scopes: `instagram_business_basic`, `instagram_business_manage_comments`, `instagram_business_manage_messages`) | Admin | – | 302 | F01 |
| GET /api/instagram/callback | Code → Short-lived Token → Long-lived Token (60 Tage), Account speichern, `POST /me/subscribed_apps?subscribed_fields=comments,messages,messaging_postbacks` | Admin (state-Param) | code, state | Redirect S02 | F01 |
| GET /api/instagram/media | Letzte 50 Posts/Reels für den Post-Picker (`/me/media?fields=id,caption,media_type,thumbnail_url,media_url,permalink,timestamp`) | Admin | cursor | Liste | F01 (S05) |
| actions `createAutomation`, `updateAutomation` | Validieren (zod), Keywords normalisieren, speichern | Admin | Formular S04 | Automation | F01 |
| action `toggleAutomation` | aktiv/aus, setzt `activated_at` | Admin | id, active | ok | F01 |
| action `deleteAutomation` | löschen (Runs kaskadieren) | Admin | id | ok | F01 |
| GET /automations, /automations/[id] | Liste + Editor + Funnel | Admin | – | Seite S03/S04/S08 | F01 |
| GET /contacts, /contacts/[id] | Kontaktliste, Filter Automation/Status, Timeline | Admin | Filter | Seite S06/S07 | – |
| GET /settings | Verbindung, Token-Ablauf, Fehler-Log (letzte 100 `events` mit kind=api_error) | Admin | – | Seite S02 | – |

### F02/F03 Lead kommentiert → DM → Klick → Follow-Check → Lieferung

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| GET /api/webhooks/instagram | Verify-Handshake (`hub.mode`, `hub.verify_token`, `hub.challenge`) | Meta | Query | challenge | – |
| POST /api/webhooks/instagram | Signatur `X-Hub-Signature-256` prüfen (HMAC-SHA256 über Raw-Body mit App Secret), Event in `events` mit `dedupe_key` schreiben, **sofort 200**, Verarbeitung danach (`after()`) | Meta | JSON | 200 | F02, F03 |
| GET /r/[runId]/[target] | Klick in `link_clicks` loggen, 302 auf `delivery_url` / `bonus_url` | öffentlich | – | 302 | F02 |

Verarbeitung `comments`-Event (`entry[].changes[].value`: `id`, `text`, `from.id`, `from.username`, `media.id`):
1. Ignorieren, wenn `from.id` = eigener Account (sonst Schleife über die eigene öffentliche Antwort) oder `parent_id` gesetzt ist und von uns stammt.
2. Passende aktive Automation finden: zuerst `single` mit gleicher `media_id`, dann `next` (bindet den Post, wenn er nach `activated_at` erstellt wurde), dann `all`. Keyword-Match: `normalize(text).includes(kw)` und kein `exclude_keywords`-Treffer.
3. Contact upserten, Run anlegen (Unique-Fehler → Ende, schon bearbeitet).
4. Optional öffentliche Antwort: `POST /{comment_id}/replies` mit zufälliger Variante aus `public_replies`.
5. Private Reply: `POST /{ig_user_id}/messages` mit `recipient.comment_id` und Button-Template (`postback`, payload `RUN:<runId>:YES`). → `status=dm_sent`.

Verarbeitung `messaging`-Event (`postback.payload` oder `message.quick_reply.payload`; `message.is_echo` ignorieren):
1. `RUN:<id>:YES` oder `RUN:<id>:CHECK` parsen. `contacts.last_interaction_at=now()`, `window_expires_at=now()+24h`.
2. Wenn `follow_gate`: `GET /{igsid}?fields=username,name,is_user_follow_business`.
   - `true` → liefern.
   - `false` und `follow_attempts < max` → Follow-Aufforderung mit Button `RUN:<id>:CHECK`, `status=follow_pending`, `follow_attempts+1`.
   - Versuche aufgebraucht → liefern, wenn `deliver_when_gate_exhausted`, sonst freundlich beenden.
3. Liefern: Nachricht 1 mit `delivery_text` und URL-Button auf `/r/<runId>/delivery`, danach Nachricht 2 mit `bonus_text` und Button auf `/r/<runId>/bonus`. → `status=delivered`.

Webhooks in: Instagram (`comments`, `messages`, `messaging_postbacks`). Webhooks out: keine.

Jobs:
- `refresh-token`, täglich 03:00 UTC: wenn `token_expires_at < now()+10 Tage`, `GET /refresh_access_token?grant_type=ig_refresh_token` aufrufen und speichern. Fehler landen im Log und als Banner im Dashboard.
- `cleanup`, täglich: Runs mit `window_expires_at < now()` und Status `clicked`/`follow_pending` → `expired`. Events älter als 90 Tage löschen.

Rechtliche Seiten, die Meta für eine Live-App verlangt: `/datenschutz` und `/datenloeschung` (Anleitung zur Löschung; Kontakt löschen kaskadiert Runs und Klicks).

## The parts that bite

- **Meta-Zugriff:** im Spike am 2026-10-16 geklärt. Standard Access + App auf Live reicht, keine App-Prüfung (siehe `spike-meta.md`). Beim Verbinden immer `subscribed_apps` mit allen drei Feldern setzen.
- **Idempotenz:** Meta stellt Webhooks erneut zu, wenn keine 200 kommt, und bei Boosted Posts auch doppelt. Deshalb sofort 200 senden, den Dedupe-Key in `events` schreiben und die Unique-Constraints auf `runs` nutzen.
- **Race:** Doppelklick auf „Ja“ → zwei Postbacks. Der Run wird per `select … for update` gesperrt, und der Statusübergang greift nur aus `dm_sent`/`follow_pending` heraus.
- **Zeitfenster:** Private Reply nur bis 7 Tage nach dem Kommentar (alte Kommentare beim Aktivieren nicht nachholen). Nach dem Klick 24 h für weitere Nachrichten, danach kein Senden mehr (`window_expires_at`).
- **Rate Limits:** 750 Private Replies pro Stunde und Account. Bei Fehlercode 4/17/32/613 oder 80002 drei Retries mit Backoff, danach `failed` mit Fehler im Log.
- **Token:** Der Long-lived Token läuft nach 60 Tagen ab und lässt sich nur erneuern, solange er noch gilt. Den täglichen Job also nicht vergessen; er wird verschlüsselt gespeichert.
- **Keywords:** Nur Enthält-Match: Groß-/Kleinschreibung, Akzente, Emojis und Satzzeichen werden entfernt. „Kita“ trifft auch „Kitas“ und „Kitaplatz“; Ausschluss-Wörter fangen das ab.
- **Eigene Kommentare:** Die eigene öffentliche Antwort löst ebenfalls einen Webhook aus und muss ignoriert werden.
- **Zeitzonen:** Alles in UTC; das Dashboard zeigt Europe/Berlin.
- **DSGVO:** Du verarbeitest IG-IDs und Usernames. Dafür brauchst du eine Datenschutzerklärung, eine Löschfunktion pro Kontakt und eine Aufbewahrungsfrist (Events nach 90 Tagen löschen).
- **Meta-Policy:** Ein Follow-Gate ist verbreitet. Bei Ablehnung trotzdem liefern (Standard `deliver_when_gate_exhausted=true`) senkt das Risiko, als Spam eingestuft zu werden.

## Build order

0. **Spike (Tag 1):** `spike/server.mjs` + `spike-meta.md`. Ohne grünes Ergebnis geht es nicht weiter.
1. **Vertical Slice:** S01 Login, S02 Verbinden, eine fest eingestellte Automation per Seed. Tabellen `account`, `automations`, `contacts`, `runs`, `events`. Routen: Login, connect/callback, Webhook GET/POST. Ergebnis: ein echter Kommentar „Kita“ führt zu DM, Klick, Follow-Check und Lieferung, deployed auf Railway.
2. **Must-haves:** S03 Liste, S04 Editor (Formular), S05 Post-Picker; Dedupe und Race-Schutz; Token-Refresh-Job; Follow-Gate mit Max-Versuchen.
3. **Should-haves:** öffentliche Antworten (3 Varianten), Scopes `all`/`next`, Ausschluss-Wörter, S06/S07 Kontakte, S08 Funnel, `/r/`-Klick-Tracking + `link_clicks`, `{{vorname}}`, Fehler-Log in S02, Cleanup-Job, Datenschutzseiten.
4. **Fixes aus replica-entrepreneur:** offen.
