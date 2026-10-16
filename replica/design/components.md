# Komponenten

Alle Farben über Tokens (`bg-surface`, `text-muted`, …), nie Hex im Markup. Icons: Lucide (ISC-Lizenz). Schrift: Inter (OFL). Alle Texte selbst geschrieben.
Code: `src/components/ui.tsx`, Live-Ansicht unter `/design`.

```
Button
  variants  primary, secondary, ghost, danger
  sizes     sm 32px, md 40px
  states    default, hover, active, focus-visible (2px Ring accent, 2px Abstand), disabled, loading (Spinner + Label bleibt)
  tokens    primary: bg accent / hover accent-hover / text on-accent; secondary: bg bg, border border, text text; radius md; font sm/600
  a11y      echtes <button>; aria-busy beim Laden
  used on   alle

Input / Textarea
  states    default, focus-visible (Ring accent), invalid (border danger + Hilfetext danger), disabled
  tokens    border border-input, radius md, text sm, Label sm/600, Hinweis xs text-muted
  a11y      <label for>, aria-invalid, aria-describedby → Fehler/Hinweis; Zeichenzähler bei DM-Texten (Instagram-Limit 1000; Button-Template-Text 640)
  used on   S01, S04

Toggle (Switch)
  states    an, aus, focus-visible, disabled
  tokens    an: bg accent; aus: bg border-input
  a11y      <button role="switch" aria-checked>, Space/Enter schaltet
  used on   S03, S04

KeywordInput (Chips)
  states    leer, gefüllt, Duplikat (Chip wird nicht hinzugefügt, Hinweis), invalid (kein Keyword)
  verhalten Enter oder Komma fügt hinzu, Backspace im leeren Feld entfernt letzten Chip, × je Chip
  a11y      Chips als Liste, × mit aria-label "Keyword X entfernen"
  used on   S04

PhonePreview
  zeigt     Kommentar → öffentliche Antwort → DM-Blasen (eingehend grau bubble-in) mit Buttons, live aus dem Formular
  a11y      aria-hidden (rein visuell, Inhalte stehen im Formular)
  used on   S04

PostPicker (Dialog)
  states    laden, leer ("Keine Beiträge gefunden"), nicht verbunden, gefüllt, ausgewählt (Ring accent + Haken)
  a11y      <dialog> mit Fokusfalle (nativ), Esc schließt, Kacheln sind <button> mit Bildunterschrift als Label
  used on   S04

Card
  tokens    bg bg, border border, radius lg, shadow card, padding 24
  used on   alle

Badge (Status)
  variants  neutral, accent, success, warning, danger
  tokens    *-soft Hintergrund + Volltonfarbe als Text, radius pill, font xs/600
  used on   S03, S06, S07

Table
  states    leer (EmptyState), gefüllt; Zeile hover bg surface
  a11y      echtes <table>, <th scope="col">
  used on   S03, S06

Funnel
  zeigt     5 Stufen (Kommentare, DM gesendet, Geklickt, Geliefert, Link geklickt) mit Zahl + Prozent der ersten Stufe, Balken in accent
  states    leer (0 überall, Hinweis)
  used on   S03, S08

EmptyState
  Icon + Titel + ein Satz + optionaler Button
  used on   S03, S06, PostPicker

Flash (Toast-Ersatz)
  variants  success, danger
  verhalten serverseitig über ?ok= / ?error=, role="status" bzw. "alert"
  used on   alle

Sidebar-Nav
  Breite 240, aktiver Link bg accent-soft text accent, mobil oben als Leiste
  a11y      <nav aria-label="Hauptnavigation">, aria-current="page"
```
