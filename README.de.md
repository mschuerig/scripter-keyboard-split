[English](README.md) · [Deutsch](README.de.md)

# scripter-keyboard-split

Ein kleines **Scripter-Plug-in für MainStage und Logic Pro**, das deine
MIDI-Tastatur auf zwei MIDI-Kanäle aufteilt — damit du z.B. das obere
und das untere Manual einer Hammond-Orgel auf einer einzigen Tastatur
spielen kannst, ohne dass dir der Splitpunkt beim zweihändigen Spiel
in die Quere kommt.

## Warum das nützlich ist

Der eingebaute Split des IK-Multimedia-Hammond-Plug-ins (und ähnlicher
Plug-ins) ist eingeschränkt: Er zieht eine starre Linie über die
Tastatur. Sobald deine rechte Hand kurz nach unten wandert oder deine
linke Hand nach oben greift, zerschneidet der Split die Phrase und das
falsche Manual antwortet.

Dieses Plug-in bietet zwei Modi:

- **Fixed** — ein klassischer harter Split an einer von dir gewählten
  Note. Einfach und vorhersehbar.
- **Floating** — ein intelligenter Split, der jeder Hand unabhängig
  folgt. Jede Hand "hält" ihre Seite der Tastatur, auch wenn die Noten
  kurz in den Bereich der anderen hineinreichen.

## Was du brauchst

- **Logic Pro** oder **MainStage** in einer halbwegs aktuellen Version
  (Logic Pro 10+ / MainStage 3+, also mit Scripter).
- Ein Plug-in oder Setup, das verschiedene Klänge auf verschiedenen
  MIDI-Kanälen spielen kann. Typische Beispiele:
    - Das **IK-Multimedia-Hammond**-Plug-in (Obermanual und
      Untermanual werden über MIDI-Kanäle angesprochen).
    - Native Instruments **Vintage Organs**, GG Audio **Blue3** oder
      eine andere Orgel mit kanalbasiertem Split.
    - Zwei separate Instrumenten-Spuren, jede mit einem eigenen
      MIDI-Empfangskanal.
    - Ein multitimbraler Sampler mit zwei Parts.

## Installation

1. Lade **`scripter-keyboard-split.js`** aus diesem Repository herunter.
2. Öffne in MainStage (oder Logic) den Channel-Strip mit dem
   Instrument, das du splitten möchtest.
3. Füge **Scripter** als MIDI-FX **oberhalb** des
   Instrumenten-Plug-ins ein.
   *(Channel-Strip → MIDI-FX-Slot → Scripter)*
4. Klicke auf **Skript-Editor öffnen** (engl. *Open Script Editor*).
5. Öffne `scripter-keyboard-split.js` in einem beliebigen Texteditor.
   Alles auswählen (⌘A), kopieren (⌘C).
6. Im Skript-Editor den vorhandenen Beispiel-Code komplett ersetzen
   durch das Eingefügte (⌘V).
7. **Run Script** klicken. Die Regler und Menüs erscheinen im
   Scripter-Fenster.
8. Stelle dein Empfänger-Instrument auf die zwei MIDI-Kanäle ein
   (siehe weiter unten) — und du kannst spielen.

## Die Bedienelemente

Alle Einstellungen sind im Scripter-Fenster sichtbar, sobald das
Skript läuft.

| Regler | Wirkung |
|---|---|
| **Split Mode** | *Fixed* zieht eine harte Linie. *Floating* lässt die Linie mit deinem Spiel mitwandern, damit zweihändige Phrasen zusammenbleiben. |
| **Base Split Point** | Die Note in der Mitte des Splits. `60` ist das eingestrichene C. Im Fixed-Modus gehen Noten ab dieser Tonhöhe nach oben. Im Floating-Modus ist das der Bezugspunkt für den Floating-Bereich. |
| **Floating Range Above** | (nur im Floating-Modus) Wie viele Halbtöne *oberhalb* des Splitpunkts der obere Bereich für sich beanspruchen darf. Größer = großzügiger. |
| **Floating Range Below** | (nur im Floating-Modus) Wie viele Halbtöne *unterhalb* des Splitpunkts der untere Bereich für sich beanspruchen darf. |
| **Upper Region Channel** | Der MIDI-Kanal für Noten, die zur oberen Region gehen. Standard `1`. Stell dein Obermanual / dein oberes Instrument auf diesen Kanal ein. |
| **Lower Region Channel** | Der MIDI-Kanal für Noten, die zur unteren Region gehen. Standard `2`. Stell dein Untermanual / dein unteres Instrument auf diesen Kanal ein. |
| **Upper Region Transpose** | Die obere Seite in ganzen Oktaven nach oben oder unten verschieben. Nützlich, wenn der Klang des Obermanuals in einer anderen Lage sitzt als deine Hand. |
| **Lower Region Transpose** | Die untere Seite in ganzen Oktaven verschieben. Typisch: `-1`, damit deine linke Hand am eingestrichenen C den tiefen Bereich des Untermanuals spielt. |

### Sinnvolle Startwerte

- Hammond-Orgel mit zwei Manualen: **Floating**, Base Split `60`,
  Floating Range Above/Below `3`, Upper Channel `1`, Lower Channel
  `2`, Lower Transpose `-1`.
- Klavier rechts, Bass links: **Fixed**, Base Split etwa `48` (das C
  unterhalb des eingestrichenen C), Lower Transpose `-1` oder `-2`,
  falls nötig.

## Empfänger-Plug-in einrichten

Das Plug-in leitet das MIDI nur auf zwei Kanäle. Dein Instrument muss
selbst wissen, welcher Klang auf welchem Kanal antworten soll.

**Für IK Hammond / Vintage B3 / Blue3:** Öffne die MIDI-Einstellungen
des Plug-ins und stelle das Obermanual auf MIDI-Kanal `1`, das
Untermanual auf Kanal `2` (bzw. die Kanäle, die du oben eingestellt
hast).

**Für zwei separate Plug-in-Spuren:** Lege je ein Instrument auf jede
Spur, setze den MIDI-Empfangskanal jeder Spur auf "MIDI-Kanal 1" bzw.
"MIDI-Kanal 2" und schicke beide Spuren das MIDI vom Channel-Strip
mit Scripter.

**Für einen multitimbralen Sampler:** Ordne in der Part-Liste des
Samplers den oberen und unteren Klang den passenden MIDI-Kanälen zu.

## Beispiel: Warum der Floating-Modus etwas bringt

Stell dir vor, deine rechte Hand spielt eine absteigende Melodie —
`E4, D4, C4, H3` (MIDI-Noten `64, 62, 60, 59`) — während die linke
Hand zwischen jedem rechten Anschlag ein `E3` (Note `52`) tritt. Du
spielst also tatsächlich:

```
64, 52, 62, 52, 60, 52, 59
```

Mit einem **Fixed Split bei Note 60**:
- `64` → oben ✓
- `52` → unten ✓
- `62` → oben ✓
- `52` → unten ✓
- `60` → oben ✓
- `52` → unten ✓
- `59` → **unten** ✗ — dein rechtes H landet mitten in der Phrase
  plötzlich auf dem Untermanual.

Mit **Floating** merkt sich das Plug-in, wo jede Hand zuletzt war.
Die rechte Hand bewegt sich um `60–64`; wenn das `59` kommt, geht es
zu der zuletzt gehörten Note, die ihm am nächsten ist — also dem
rechten `60`, nicht dem linken `52`. Die Melodie bleibt geschlossen
auf dem Obermanual.

## Fehlersuche

**Es kommt nichts oder nur eine Seite ist zu hören.**
Prüfe den MIDI-Empfangskanal deines Instruments. In den
Scripter-Parametern siehst du, auf welchen Kanal jede Seite sendet —
das Instrument muss genau auf diesen Kanal hören.

**Eine Note hängt.**
Das Skript merkt sich, auf welchen Kanal jedes Note On ging, damit das
zugehörige Note Off auf dem gleichen Kanal ankommt — selbst wenn du
zwischendurch den Split veränderst. Sollte trotzdem mal eine Note
hängen bleiben (selten — meistens nur, wenn das Skript gestartet
wurde, während eine Taste gerade gedrückt war), **Run Script** kurz
aus- und wieder einschalten oder die Note erneut anschlagen und
loslassen.

**Im Floating-Modus springen Noten manchmal auf die falsche Seite.**
Probier eine kleinere Floating Range. Je größer der Bereich, desto
eher "greift" das Plug-in über den Splitpunkt hinaus. Wenn du
ohnehin strikt zweistimmig spielst und die Hände nie kreuzen, ist
Fixed-Modus vielleicht der bequemere Weg.

**Wo finde ich die aktuelle Datei?**
Die aktuelle Version von `scripter-keyboard-split.js` liegt im
Hauptverzeichnis dieses Repositories. Über den "Raw"-Button bei
GitHub kannst du den Inhalt direkt kopieren oder das ganze Repository
als ZIP herunterladen.

## Lizenz

MIT — siehe [LICENSE](LICENSE).

---

## Implementierungsdetails

*Der folgende Abschnitt richtet sich an Neugierige oder Entwickler.
Um das Plug-in einfach zu benutzen, brauchst du nichts davon.*

### Wie der Algorithmus funktioniert

- **Fixed-Modus** ist eine Zeile: `pitch >= baseSplit → oben`, sonst
  unten.
- **Floating-Modus** führt zwei Zustände mit: die zuletzt nach oben
  geroutete Tonhöhe (`lastPitchUpper`) und die zuletzt nach unten
  geroutete (`lastPitchLower`). Bei jedem Note On fragt der
  Algorithmus: *Darf die neue Note zur oberen Region "gehören"
  (innerhalb der Floating Range)? Darf sie zur unteren?*
    - Beansprucht nur eine Region die Note, geht sie dorthin.
    - Beanspruchen beide, geht sie zu derjenigen Region, deren
      zuletzt gehörte Note in Halbtönen näher ist.
    - Beansprucht keine, greift die Fixed-Split-Regel als Fallback.
- **Note-to-Channel-Zuordnung:** Ein `noteToChannel[0..127]`-Array
  merkt sich, auf welchem Kanal jedes Note On gesendet wurde, damit
  das passende Note Off immer auf demselben Kanal landet — auch wenn
  zwischendurch der Splitpunkt oder der Modus geändert wurde.

### Aufbau des Projekts

| Datei | Zweck |
|---|---|
| `split-router.js` | Die alleinige Quelle für die Routing-Logik. Reines JavaScript ohne Scripter-Abhängigkeiten — voll unit-testbar. |
| `split-router.test.js` | Bun-Testsuite für beide Modi, das zweihändige Wechselmuster, melodische Geschlossenheit, Crossover und die Transponier-Hilfsfunktion. |
| `scripter-keyboard-split.template.js` | Handgepflegtes Scripter-Gerüst mit einem `@inject:split-router`-Marker. |
| `build.js` | Entfernt `export ` aus `split-router.js` und fügt den Code an der Marker-Stelle der Vorlage ein. |
| `scripter-keyboard-split.js` | Wird von `bun run build` erzeugt. Diese Datei kopierst du in Scripter. Sie ist mit eingecheckt, damit man sie ohne Build-Tools verwenden kann. |

### Entwicklung

```bash
bun install       # keine Laufzeit-Abhängigkeiten, erzeugt nur die Lockfile
bun test          # Routing-Tests ausführen
bun run build     # scripter-keyboard-split.js neu generieren
```

GitHub Actions führt `bun test` bei jedem Push und Pull Request aus
— siehe `.github/workflows/test.yml`.

### Beitragen

Wenn du den Routing-Algorithmus änderst:
1. Bearbeite `split-router.js` und ergänze einen Test in
   `split-router.test.js`.
2. Führe `bun test` aus und prüfe, dass alles grün ist.
3. Führe `bun run build` aus und committe die neu generierte
   `scripter-keyboard-split.js` mit.

Wenn du das Scripter-Gerüst änderst (Parameter, MIDI-Verarbeitung),
bearbeite `scripter-keyboard-split.template.js` und baue dann neu.
