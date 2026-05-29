[English](README.md) · [Deutsch](README.de.md)

# scripter-keyboard-split

Ein Skript für das **Scripter-Plug-in von MainStage / Logic Pro**, das
deine MIDI-Tastatur in bis zu vier Regionen aufteilt und jede auf
einem eigenen MIDI-Kanal sendet — damit du z.B. das obere und untere
Manual einer Hammond-Orgel auf einer einzigen Tastatur spielen kannst,
ohne dass dir der Splitpunkt beim zweihändigen Spiel in die Quere
kommt. Eine dritte oder vierte Region kannst du für einen Basspedal-
Bereich, eine Lead-Stimme oder ein paar Tasten mit Sound-Effekten
hinzunehmen.

> **Frühes Stadium.** Harte Splits (Floating Range Above und Below
> beide auf `0`) sollten zuverlässig laufen — das ist einfach eine
> starre Linie auf der Tastatur. Die smarte Logik mit Floating Ranges
> größer als 0 ist neuer und kann in Randfällen noch überraschen.
> Wenn dir mitten in einer Phrase etwas merkwürdig vorkommt, ist der
> schnellste Ausweg, die Floating Range Above und Below des
> betreffenden Splits auf `0` zu setzen.

## Warum das nützlich ist

- Die Split-Funktion mancher virtueller Instrumenten-Plug-ins ist
  eingeschränkt: Sie zieht eine starre Linie über die Tastatur.
- MainStage schickt Splits immer auf separate Channel-Strips, auch
  wenn ein einzelnes Plug-in das genauso gut (oder besser) erledigen
  könnte.

Jeder Splitpunkt hat eine **Floating Range** ober- und unterhalb.
Beide auf `0` gesetzt ergeben einen klassischen harten Split — eine
starre Linie. Auf ein paar Halbtöne gesetzt entsteht ein **smarter
Split**, der jeder Hand unabhängig folgt: Jede Hand "hält" ihre Seite
der Tastatur innerhalb dieser Floating Range, auch wenn die Noten
kurz hinüberreichen. Du kannst harte und smarte Splits in einer
Konfiguration kombinieren.

## Was du brauchst

- **Logic Pro** oder **MainStage** in einer halbwegs aktuellen Version
  (Logic Pro 10+ / MainStage 3+, also mit Scripter).
- Ein Plug-in auf demselben Channel-Strip, das verschiedene Klänge
  auf verschiedenen MIDI-Kanälen spielen kann. (Scripter schickt MIDI
  nur den eigenen Channel-Strip hinunter — es kann keine andere Spur
  ansprechen.) Typische Beispiele:
    - Das **IK Multimedia Hammond 3-BX**-Plug-in (Obermanual und
      Untermanual werden über MIDI-Kanäle angesprochen).
    - Native Instruments **Vintage Organs**, GG Audio **Blue3** oder
      eine andere Orgel mit kanalbasiertem Split.
    - Zwei oder mehr separate Instrumenten-Spuren, jede mit einem
      eigenen MIDI-Empfangskanal.
    - Ein multitimbraler Sampler, dessen Parts unterschiedlichen
      MIDI-Kanälen zugewiesen sind.

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
8. Stelle dein Empfänger-Instrument auf die unten gewählten Kanäle
   ein — und du kannst spielen.

## Die Bedienelemente

Das Scripter-Fenster listet die Regler von der obersten Region der
Tastatur (oben in der Liste) bis zur untersten (unten in der Liste).
**Region 1** ist die oberste Region, Region 2 die nächste darunter
und so weiter. **Split Point N** ist die Grenze zwischen Region N
und Region N+1. Wenn du **Number of Splits** erhöhst, erscheinen
weitere Zeilen am Ende der Liste (= eine neue Region am unteren Ende
der Tastatur); wenn du es verringerst, verschwinden sie wieder.

| Regler | Wirkung |
|---|---|
| **Number of Splits** | Wie viele Splitpunkte aktiv sind (1–3). Ein Split ergibt zwei Regionen, zwei Splits drei und so weiter. Die Zeilen für nicht benötigte Splits und Regionen werden ausgeblendet. |
| **Region N Channel** | Der MIDI-Kanal, auf dem Noten der Region N gesendet werden. Voreinstellungen: `1, 2, 3, 4` — Region 1 (die oberste Region, typisch das Obermanual oder die rechte Melodiehand) liegt konventionell auf Kanal 1. |
| **Region N Transpose** | Region N in ganzen Oktaven nach oben oder unten verschieben. Typisch für die unterste Region in einem Hammond-Setup: `-1`, damit deine linke Hand am eingestrichenen C den unteren Bereich des Untermanuals spielt. |
| **Split Point N** | Die Note, an der Split N die Tastatur teilt. `60` ist das eingestrichene C. Eine Note exakt auf einem Splitpunkt geht in die Region oberhalb. Die Nummerierung gibt keine Reihenfolge der Tonhöhen vor — wenn du Split Point 2 über Split Point 1 setzt, sortiert das Skript intern. |
| **Floating Range Above N / Floating Range Below N** | Wie viele Halbtöne oberhalb/unterhalb von Split N die angrenzenden Regionen beanspruchen dürfen. Das ist eine harte Obergrenze für die Reichweite jeder Region — eine Region kann sich nicht weiter ausdehnen als ihre Floating Range, egal wo ihre letzte Note lag. **Beide auf 0** = ein harter, starrer Split. Größere Werte = jede Region darf mehr Noten jenseits der Linie für sich beanspruchen, und im Überlappungsbereich gewinnt diejenige, deren letzte Note näher liegt. |

### Sinnvolle Startwerte

- **Hammond-Orgel mit zwei Manualen** — Number of Splits `1 split
  (2 regions)`, Split Point 1 `60`, Floating Range Above 1 = Floating
  Range Below 1 = `3`. Die Voreinstellungen geben Region 1
  (Obermanual) Kanal `1` und Region 2 (Untermanual) Kanal `2`. Region
  2 Transpose auf `-1`.
- **Klavier rechts, Bass links** — Number of Splits `1 split (2
  regions)`, Split Point 1 etwa `48` (das C unterhalb des
  eingestrichenen C), Floating Range Above 1 = Floating Range Below 1
  = `0` (harter Split). Region 2 Transpose `-1` oder `-2`, falls
  nötig.
- **Hammond mit Basspedal-Bereich** — Number of Splits `2 splits (3
  regions)`, Split Point 1 etwa `60` (zwischen Ober- und Untermanual),
  Split Point 2 etwa `48` (zwischen Untermanual und Bass). Für den
  Manual-Split (Split 1) z.B. Floating Range `3 / 3`; für den Bass-
  Split (Split 2) Floating Range `0 / 0` — eine harte Grenze, damit
  der Bass nicht nach oben leckt. Voreinstellungen: Region 1
  (Obermanual) Kanal `1`, Region 2 (Untermanual) Kanal `2`, Region 3
  (Bass) Kanal `3`. Region 3 Transpose `-2`, falls dein Basssound
  unterhalb deiner Handlage sitzt.
- **Sound-Effekte auf den obersten Tasten** — Split Point 1 auf etwa
  `96`–`108` setzen (trennt die FX-Zone von allem darunter), Floating
  Range `0 / 0` (harte Linie) und den Kanal von Region 1 einem
  separaten FX-Instrument zuweisen.

## Empfänger-Plug-in einrichten

Das Plug-in leitet das MIDI nur auf mehrere Kanäle. Du musst dem
Empfänger-Plug-in noch sagen, welcher Klang auf welchem Kanal
antworten soll — und das Plug-in muss auf demselben Channel-Strip wie
Scripter liegen, weil Scripter das MIDI nur in die Plug-ins darunter
auf seinem eigenen Strip einspeist.

**Für IK Hammond / Vintage B3 / Blue3:** Öffne die MIDI-Einstellungen
des Plug-ins und stelle jedes Manual auf den Kanal, der in der
entsprechenden Region-Zeile oben steht.

**Für einen multitimbralen Sampler:** Ordne jeden Klang dem Kanal der
Region zu, die ihn auslösen soll.

## Beispiel: Warum ein smarter Split etwas bringt

Stell dir vor, deine rechte Hand spielt eine absteigende Melodie —
`E4, D4, C4, H3` (MIDI-Noten `64, 62, 60, 59`) — während die linke
Hand zwischen jedem rechten Anschlag ein `E3` (Note `52`) tritt. Du
spielst also tatsächlich:

```
64, 52, 62, 52, 60, 52, 59
```

Mit einem **harten Split bei Note 60** (Floating Ranges `0 / 0`):
- `64` → oben ✓
- `52` → unten ✓
- `62` → oben ✓
- `52` → unten ✓
- `60` → oben ✓
- `52` → unten ✓
- `59` → **unten** ✗ — dein rechtes H landet mitten in der Phrase
  plötzlich auf dem Untermanual.

Mit **Floating Range Above und Below auf 3** reicht jede Region `3`
Halbtöne über den Splitpunkt hinaus — beide Regionen können die Noten
zwischen `57` und `63` für sich beanspruchen, und es gewinnt die mit
der näher liegenden letzten Note. Die rechte Hand bewegt sich um
`60–64`; wenn das `59` kommt, ist es näher am rechten `60` als am
linken `52`, und die Melodie bleibt geschlossen auf dem Obermanual.

Das Prinzip gilt auch mit mehr Splits: Jede Region merkt sich ihre
eigene letzte Note, sodass ein Walking Bass unter einem Akkord und
darüber einer Melodiestimme nicht ineinander rutschen.

## Fehlersuche

**Es kommt nichts oder nur ein Teil der Regionen ist zu hören.**
Prüfe den MIDI-Empfangskanal deines Instruments. In den
Scripter-Parametern siehst du, auf welchen Kanal jede Region sendet —
das Instrument muss genau auf diesen Kanal hören.

**Eine Note hängt.**
Schnellste Hilfe — ein MIDI-Panic:
- **MainStage**: *Aktionen → Panik* (⌃P).
- **Logic Pro**: siehe [Anleitung von Apple](https://support.apple.com/de-de/guide/logicpro/lgcpc412346d/mac).

Das Skript merkt sich, auf welchen Kanal jedes Note On ging, damit das
zugehörige Note Off auf demselben Kanal ankommt — selbst wenn du
zwischendurch den Split veränderst. Hängende Noten sind selten und
treten meist nur dann auf, wenn das Skript gestartet wurde, während
eine Taste gerade gedrückt war.

**Noten springen manchmal in die falsche Region.**
Probier kleinere Floating Ranges. Je größer der Bereich, desto eher
greift eine Region über einen Splitpunkt hinaus. Wenn du an diesem
Split ohnehin strikt getrennte Stimmen spielst, setz die Floating
Ranges auf `0`.

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

- Die Tastatur wird von N Splitpunkten in N+1 Regionen geteilt. Der
  Router indiziert sie null-basiert nach Tonhöhe — Router-Region 0
  ist die tiefste Tonhöhenregion, Router-Region N die höchste. (Die
  UI-Beschriftung läuft anders herum: UI Region 1 = Router-Region N
  = oben, UI Region N+1 = Router-Region 0 = unten. Das Wrapper-
  Skript übersetzt das in `rebuildCache`.) Jeder Splitpunkt hat eine
  Floating Range Above und Below (in Halbtönen).
- Jede Region hat eine **Claim Zone** in Tonhöhen:
    - Region 0: `(-∞, splitPoints[0] + above_0]`
    - Region k (Mitte): `[splitPoints[k-1] − below_{k-1}, splitPoints[k] + above_k]`
    - Region N: `[splitPoints[N-1] − below_{N-1}, +∞)`
  Eine Region kann eine Note nur dann für sich beanspruchen, wenn
  die Note in ihrer Claim Zone liegt — die Floating Range ist eine
  harte Obergrenze für die Reichweite einer Region.
- Für jede eingehende Note:
  1. Sammle alle Regionen, deren Claim Zone die Note enthält.
  2. **Folge der Hand:** Ist die Region der *vorherigen* Note dabei,
     bleibt die neue Note bei ihr — es sei denn, die zuletzt
     geroutete Note einer anderen Region liegt um mehr als einen
     kleinen Puffer von Halbtönen näher als die vorherige. So bleibt
     eine durch die aktive Region laufende Melodie dort, ohne dass
     eine veraltete oder zufällig passende letzte Note der anderen
     Region sie hinüberzieht — während eine deutlich näher liegende
     andere Hand die Note durchaus zurückerobern kann (z.B. beim
     zweihändigen Orgelmuster, wo die letzte Note der anderen Region
     viel näher liegt als die gerade gespielte).
  3. Sonst gewinnt die Region, deren zuletzt geroutete Note in
     Halbtönen am nächsten liegt; Regionen ohne letzte Note gelten
     als unendlich weit weg; bei Gleichstand gewinnt die höhere
     Region.
- **Harter Split** ist derselbe Algorithmus mit beiden Ranges eines
  Splits auf 0: Die Claim Zones der zwei angrenzenden Regionen
  berühren sich am Splitpunkt ohne Überlappung (außer am Splitpunkt
  selbst, den der Gleichstand-Mechanismus an die obere Region gibt).
  Harte und smarte Splits dürfen in einer Konfiguration gemischt
  werden.
- **Note-to-Channel-Zuordnung**: Ein `noteToChannel[0..127]`-Array
  merkt sich, auf welchem Kanal jedes Note On gesendet wurde, damit
  das passende Note Off immer auf demselben Kanal landet — auch wenn
  zwischendurch das Split-Layout geändert wurde.
- **Hot-Path-Disziplin**: `HandleMIDI` läuft bei jedem MIDI-Event.
  Der gesamte Routing-Zustand liegt in einem `cache`-Objekt, das
  ausschließlich in `rebuildCache` an Ort und Stelle mutiert wird —
  und das nur bei einer Parameteränderung. Der Cache enthält neben
  den sortierten Splitpunkten auch vorausberechnete Claim-Grenzen
  pro Region (`cache.lowerBounds[k]` / `cache.upperBounds[k]`), die
  Kanal- und Transponier-Tabellen pro Region und ein dedupliziertes
  Failsafe-Set. Der Router liest die Grenzen direkt — keine
  Arithmetik im Hot Path, keine Allokationen pro Event, keine
  `GetParameter`-Aufrufe. Selbst `rebuildCache` allokiert nach dem
  Warmup nichts mehr: die Sortier-Scratchpuffer werden einmal beim
  Script-Laden angelegt und wiederverwendet.

### Aufbau des Projekts

| Datei | Zweck |
|---|---|
| `split-router.js` | Die alleinige Quelle für den N-Region-Routing-Algorithmus. Reines JavaScript ohne Scripter-Abhängigkeiten — voll unit-testbar. |
| `split-router.test.js` | Bun-Testsuite für Konfigurationen mit ein und zwei Splits, harte vs. smarte Splits, gemischte Splits, defensive Sortierung und die Transponier-Hilfsfunktion. |
| `scripter-keyboard-split.template.js` | Handgepflegtes Scripter-Gerüst. Enthält die `MAX_SPLITS`-Konstante, den Parameter-Generator, den Cache und `ParameterChanged` / `HandleMIDI`. Hat einen `@inject:split-router`-Marker. |
| `build.js` | Entfernt `export ` aus `split-router.js` und fügt den Code an der Marker-Stelle der Vorlage ein. |
| `scripter-keyboard-split.js` | Wird von `bun run build` erzeugt. Diese Datei kopierst du in Scripter. Sie ist mit eingecheckt, damit man sie ohne Build-Tools verwenden kann. |

Der Router hat keine eingebaute Obergrenze für die Zahl der Splits;
die UI-Grenze erhöhst du, indem du `MAX_SPLITS` im Template änderst.

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
