# Recon map: ManyChat (Web-App + Instagram)

Scope: Instagram Comment-to-DM mit Follow-Check und Lead-Magnet-Auslieferung (+ zweiter Lead-Magnet). Kein visueller Flow-Builder, kein Messenger/WhatsApp/SMS.
For: eigener Instagram-Business-/Creator-Account (Single-Tenant, nur ein Konto, nur du nutzt das Tool)
Date: 2026-10-16

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | ManyChat Help: Post & Reel Comments trigger | https://help.manychat.com/hc/en-us/articles/14281316989724-Instagram-Post-and-Reel-Comments-trigger | Trigger-Optionen, Keyword-Regeln, Grenzen (1x pro User pro Post, keine Ads aus Ads Manager) |
| 2 | ManyChat Help: Quick Automation – Auto-DM links from comments | https://help.manychat.com/hc/en-us/articles/16654065283100-Quick-Automation-Auto-DM-links-from-comments | Reihenfolge: Opening DM → (E-Mail) → Follow-Request → Link → Follow-up |
| 3 | ManyChat Help: Grow followers from comments | https://help.manychat.com/hc/en-us/articles/20310878273692-Quick-Automation-Grow-followers-from-comments | Follow-Gate |
| 4 | ManyChat Community: Exact match | https://community.manychat.com/general-q-a-43/instagram-comment-trigger-exact-match-for-thanks-in-manychat-9037 | Keywords nur "enthält", kein Exact Match |
| 5 | Meta: Private Replies | https://developers.facebook.com/documentation/instagram-platform/private-replies | 1 Nachricht pro Kommentar, innerhalb 7 Tagen, Webhook `comments` |
| 6 | Meta: User Profile API | https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/user-profile | `is_user_follow_business` – erst lesbar, nachdem der User geschrieben oder geklickt hat |
| 7 | Meta: App Review / Access Levels | https://developers.facebook.com/docs/instagram-platform/app-review | "Nur für eigenes Business" → Standard Access, App Review nicht nötig |
| 8 | Meta: Rate Limits | https://developers.facebook.com/docs/messenger-platform/overview/rate-limiting | 750 Private Replies / Stunde / Account |
| 9 | Preisvergleiche (Drittquellen) | https://hackceleration.com/labs/manychat-pricing , https://chatarmin.com/en/blog/manychat-pricing | Pro ab ca. 15 $/Monat, skaliert mit Kontakten; Zahlen widersprüchlich |

Kein Login in deinen ManyChat-Account erfolgt; alles aus öffentlichen Seiten. Screens unten sind aus Hilfeartikeln abgeleitet, nicht aus Screenshots.

## Core loop

Jemand kommentiert ein Keyword unter einem Post → bekommt automatisch eine DM mit Button → nach Klick (und Follow-Check) kommt der Lead-Magnet plus ein zweiter Link.

## Screens

| ID | screen | route / how to reach | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S01 | Login | /login | Zugang zum Dashboard (nur du) | Login-Form | default, error |
| S02 | Instagram verbinden | /settings/instagram | Instagram-Login (OAuth), Token-Status | Connect-Button, Status-Badge | nicht verbunden, verbunden, Token abgelaufen |
| S03 | Automationen-Liste | /automations | Alle Comment-Automationen | Tabelle, Toggle aktiv/aus, Kennzahlen | leer, gefüllt |
| S04 | Automation bearbeiten | /automations/:id | Trigger + Nachrichten konfigurieren | Post-Picker, Keyword-Chips, Textfelder, Button-Label, Link-Felder, Live-Vorschau (Handy-Mockup) | neu, gespeichert, Validierungsfehler |
| S05 | Post-Picker (Modal) | aus S04 | Post/Reel wählen: bestimmter, alle, nächster | Grid mit Thumbnails | laden, leer, gefüllt |
| S06 | Kontakte | /contacts | Wer hat kommentiert/geklickt | Tabelle, Filter nach Automation/Status, CSV-Export | leer, gefüllt |
| S07 | Kontakt-Detail | /contacts/:id | Verlauf eines Kontakts | Timeline (Kommentar, DM, Klick, Follow-Status) | gefüllt |
| S08 | Statistik | in S03/S04 | Trichter je Automation | Funnel: Kommentare → DM gesendet → Klick → gefolgt → Link geklickt | leer, gefüllt |
| S09 | Instagram-DM (beim Kommentierer) | Instagram-App | Was der Lead sieht | Text, Buttons | Inbox oder Anfragen-Ordner |

Bewusst nicht im Scope: Live-Chat-Inbox, visueller Flow-Builder, Broadcasts, Sequenzen, Team.

## Flows

```
F01 Du richtest eine Automation ein
    S03 -> S04 -> S05 (Post wählen) -> S04 (Keywords "Kita", Texte, Links) -> speichern + aktivieren
    happy path clicks: ~8
    edge: Instagram-Token abgelaufen, Post gelöscht, Keyword doppelt in zwei Automationen

F02 Lead kommentiert "Kita" und folgt bereits (Kern-Flow)
    Kommentar -> Webhook -> Keyword-Match -> öffentliche Antwort ("Schau in deine DMs 📩")
    -> Private Reply mit Button "Ja" -> Klick (Postback) -> Profil-Check is_user_follow_business = true
    -> DM 2: Lead-Magnet (Link/PDF) -> DM 3: zweiter Lead-Magnet (Website)
    happy path clicks für den Lead: 1
    edge: DM landet im Anfragen-Ordner (wenn nicht gefolgt), Kommentar "kita!" / "KITA" / "Kita bitte",
          gleicher User kommentiert zweimal, Kommentar ist von dir selbst, Antwort zu einem Antwort-Kommentar

F03 Lead kommentiert, folgt aber noch nicht
    ... -> Klick "Ja" -> Follow-Check false -> DM: "Folg mir kurz und tipp dann nochmal auf 'Erledigt'" [Button]
    -> Klick -> Check erneut -> true -> Lieferung wie F02
    edge: User klickt ohne zu folgen (max. 2-3 Versuche, danach trotzdem ausliefern oder freundlich stoppen),
          24-Stunden-Fenster läuft ab, bevor er erneut klickt

F04 Lead reagiert nie auf den Button
    Private Reply gesendet -> keine Reaktion -> keine weitere Nachricht möglich (Meta-Regel)
```

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| Button | primary, secondary, ghost, danger | default, hover, focus, disabled, loading | alle |
| Toggle | an/aus | default, disabled | S03, S04 |
| Keyword-Chip-Input | – | leer, gefüllt, Duplikat-Warnung | S04 |
| Textarea mit Variablen ({{vorname}}) | – | default, zu lang (Instagram-Limit) | S04 |
| Handy-Vorschau | DM-Ansicht | – | S04 |
| Post-Thumbnail-Grid | Post, Reel | ausgewählt, nicht | S05 |
| Tabelle | – | leer, laden, gefüllt | S03, S06 |
| Funnel-Kennzahlen | – | leer, gefüllt | S08 |
| Toast | success, error | – | alle |

## Inferred data model

```
Account       id, ig_user_id, username, access_token (verschlüsselt), token_expires_at
              evidence: Source 5/7 (Instagram Login, User Access Token)    confidence: high

Automation    id, name, active, post_scope (single | all | next), media_id?,
              keywords[] (contains-match, case-insensitive), exclude_keywords[],
              public_replies[] (bis 3, rotierend), opening_text, opening_button_label,
              follow_gate (bool), follow_prompt_text, follow_button_label,
              delivery_text, delivery_url, bonus_text, bonus_url
              evidence: Source 1/2/3                                        confidence: high

Contact       id, igsid, username, first_seen_at, is_follower (letzter Stand), tags[]
              evidence: Source 6                                            confidence: high

Run           id, automation_id, contact_id, comment_id, media_id,
              status (commented | dm_sent | clicked | follow_pending | delivered | failed),
              follow_attempts, created_at, window_expires_at
              evidence: Source 1 (1x pro User pro Post), 5 (7 Tage / 24 h)    confidence: medium (eigenes Design)

Event         id, run_id, type (webhook | send | postback | link_click), payload json, created_at
              evidence: guess – nötig für Debugging und Statistik            confidence: guess

LinkClick     id, run_id, target (delivery | bonus), clicked_at
              evidence: guess – über eigene Redirect-URL zählbar              confidence: guess
```

Relationships: Account 1-n Automation, Automation 1-n Run, Contact 1-n Run, Run 1-n Event, Run 1-n LinkClick.
Eindeutig: (automation_id, contact_id, media_id) → verhindert Doppelversand.

## Feature matrix

See `features.csv`. Must: 13, should: 8, could: 6, skip: 7.

## Out of scope (cannot or should not be cloned)

- ManyChat ist offizieller Meta Business Partner – du bist es nicht. Für ein Tool nur für dein eigenes Konto brauchst du das aber nicht (Standard Access).
- Multi-Kunden-SaaS (anderen Accounts das Tool anbieten) → bräuchte App Review + Business Verification bei Meta. Nicht Teil des Umfangs.
- Kommentare unter Ads aus dem Ads Manager – funktioniert auch bei ManyChat nicht.
- Messenger, WhatsApp, SMS, TikTok, E-Mail-Marketing, KI-Antworten, Vorlagen-Marktplatz.
- ManyChat-Texte, -Icons, -Logo, Vorlagen – alles eigene Inhalte.

## Size

Screens 8 (eigene), flows 4, entities 6.
Hard parts:
1. Meta-Setup: Developer-App, Instagram Login, Webhooks, Token-Erneuerung (60 Tage), App auf "Live" mit Datenschutz-URL.
2. Zuverlässige Webhook-Verarbeitung: Duplikate, Retries, Reihenfolge, 7-Tage- und 24-h-Fenster.
3. Follow-Gate: Follow-Status ist erst nach dem Button-Klick lesbar → Ablauf muss genau so gebaut sein.
Size: S–M (MVP ca. 1–2 Wochen Teilzeit inkl. Meta-Einrichtung).
