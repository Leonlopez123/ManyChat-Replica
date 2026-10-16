# Meta-Test (Tag 1): Reicht Standard Access für dein eigenes Konto?

Ziel: Ein fremder Account kommentiert „Kita“ unter deinem Post. Der komplette Ablauf soll ohne App-Prüfung durch Meta funktionieren.
Dauer: ca. 1–2 Stunden, den Großteil davon in Metas Dashboard.

## Was du brauchst
- Deinen Instagram-Account als **Business- oder Creator-Konto** (Professional Account).
- **Einen zweiten Instagram-Account**, der *keine* Rolle in deiner Meta-App hat, zum Beispiel von einer Freundin oder einem Kollegen. Genau das ist der Test, denn Leads haben auch keine Rolle.
- In der Instagram-App: **Einstellungen → Nachrichten → Verbundene Tools → „Zugriff auf Nachrichten erlauben“** einschalten.
- Einen Tunnel, damit Meta deinen Rechner erreicht:
  ```bash
  brew install cloudflared
  ```

## Schritt 1: Meta-App anlegen (machst du selbst, ich gebe keine Logins ein)
1. https://developers.facebook.com/apps → **App erstellen** → Use Case **„Nachrichten und Inhalte auf Instagram verwalten“**.
2. Links **Instagram → API-Einrichtung mit Instagram-Login** → **Konto hinzufügen**, mit deinem Instagram einloggen → **Token generieren**. Den Token und die angezeigte Instagram-User-ID notieren.
3. Unter **App-Einstellungen → Allgemein** (Bereich Instagram) das **Instagram App Secret** kopieren.

## Schritt 2: Spike-Server starten
```bash
cp spike/.env.example spike/.env
```
Trag in `spike/.env` APP_SECRET, IG_ACCESS_TOKEN und IG_USER_ID ein, außerdem einen frei erfundenen VERIFY_TOKEN.
```bash
node --env-file=spike/.env spike/server.mjs
```
In einem zweiten Terminal:
```bash
cloudflared tunnel --url http://localhost:3000
```
Die angezeigte `https://….trycloudflare.com`-Adresse kopieren.

## Schritt 3: Webhook bei Meta eintragen
In der API-Einrichtung unter **Webhooks konfigurieren**:
- Callback-URL: `https://….trycloudflare.com/webhook`
- Verify-Token: derselbe Wert wie VERIFY_TOKEN
- **Abonnieren** der Felder `comments`, `messages` und `messaging_postbacks`.
- Im Server-Log sollte `VERIFY_OK` stehen.

## Schritt 4: Testen (zuerst im Entwicklungsmodus, dann im Live-Modus)
Mit dem **zweiten Account**, der dir noch **nicht** folgt:
1. Unter einem deiner Posts „Kita“ kommentieren.
2. Im Anfragen-Ordner die DM öffnen und auf **Ja** tippen.
3. Erwartet wird die Follow-Aufforderung. Jetzt folgen und auf **Erledigt** tippen.
4. Erwartet werden der Leitfaden-Link und danach der Bonus-Link.

Kommt in Schritt 1 nichts im Log an, oder meldet die API einen Fehler: App oben auf **Live** schalten. Dafür verlangt Meta eine Datenschutz-URL; für den Test reicht vorerst eine einfache Seite. Dann den Test mit einem neuen Kommentar wiederholen.

## Auswertung: Log-Zeilen abhaken
| Test | Log-Zeile | Ergebnis |
| --- | --- | --- |
| Kommentar-Webhook kommt an | `TEST_1_COMMENT_WEBHOOK_OK` | ☐ |
| Öffentliche Antwort | `TEST_2_PUBLIC_REPLY_OK` | ☐ |
| Private Reply mit Button | `TEST_3_PRIVATE_REPLY_WITH_BUTTON_OK` (oder `…QUICK_REPLY_OK`) | ☐ |
| Klick kommt an | `TEST_4_CLICK_WEBHOOK_OK` | ☐ |
| Follow-Check liest den Status | `TEST_5_FOLLOW_CHECK_OK` (zuerst `follows:false`, nach dem Folgen `true`) | ☐ |
| Lieferung (2 Nachrichten) | `TEST_7_DELIVERY_OK` | ☐ |
| Modus, in dem es lief | Entwicklung / Live | ☐ |

**Alles grün:** Standard Access reicht, und der Bau startet ohne Wartezeit.
**Test 1 oder 3 rot, auch im Live-Modus:** Wir brauchen Advanced Access über die App-Prüfung (2–4 Wochen). Dann bauen wir parallel weiter und testen bis dahin mit Accounts, die eine Rolle haben.
**Nur der Button rot, der Quick Reply grün:** kein Problem, die App nutzt dann Quick Replies.

Schick mir am Ende die Log-Ausgabe (Tokens vorher entfernen) oder die ausgefüllte Tabelle.

## Ergebnis (2026-10-16): bestanden ✅

Getestet mit einem fremden Account ohne App-Rolle, der vorher nicht gefolgt ist.

| Test | Ergebnis |
| --- | --- |
| Kommentar-Webhook | ✅ (erst nach Live-Schaltung) |
| Öffentliche Antwort | ✅ |
| Private Reply mit Button-Template | ✅ (Quick-Reply-Fallback nicht nötig) |
| Klick (Postback) | ✅ |
| Follow-Check | ✅ `false` → nach Folgen sofort `true` |
| Follow-Aufforderung mit erneutem Button | ✅ |
| Lieferung (2 Nachrichten mit URL-Button) | ✅ |
| Modus | **Live**, Standard Access, **keine App-Prüfung nötig** |

Erkenntnisse für den Bau:
- Im Entwicklungsmodus kommen keine echten Kommentar-Webhooks an, auch nicht vom eigenen Konto. Nur der Test-Button im Dashboard funktioniert.
- Die Felder-Schalter im Dashboard reichen nicht: Das Konto selbst muss per `POST /me/subscribed_apps?subscribed_fields=comments,messages,messaging_postbacks` abonniert werden. Der Callback der App muss das beim Verbinden tun.
- Die eigene öffentliche Antwort löst einen `comments`-Webhook mit `from.id` = eigene IG-User-ID aus und wird korrekt übersprungen.
- Gesendete Nachrichten kommen als `messages`-Webhook mit Absender = eigenes Konto zurück (Echo) und müssen ignoriert werden.
- Meta ruft `graph.instagram.com/v26.0` als aktuelle Version auf.
