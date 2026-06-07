[English](README.md) · [Deutsch](README.de.md)

# scripter-keyboard-split

Ein Skript für das **Scripter-Plug-in von MainStage / Logic Pro**, das
deine MIDI-Tastatur in bis zu vier Zonen aufteilt und jede auf
einem eigenen MIDI-Kanal sendet — damit du z.B. das obere und untere
Manual einer Hammond-Orgel auf einer einzigen Tastatur spielen
kannst. Eine dritte oder vierte Zone kannst du für einen Basspedal-
Bereich, eine Lead-Stimme oder ein paar Tasten mit Sound-Effekten
hinzunehmen.

Jeder Split ist eine starre Linie auf der Tastatur: Noten ab dem
Splitpunkt aufwärts gehen in die obere Zone, Noten darunter in die
untere.

## Warum das nützlich ist

- Die Split-Funktion mancher virtueller Instrumenten-Plug-ins ist
  eingeschränkt: Sie zieht eine starre Linie über die Tastatur.
- MainStage schickt Splits immer auf separate Channel-Strips, auch
  wenn ein einzelnes Plug-in das genauso gut (oder besser) erledigen
  könnte.

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

Das Scripter-Fenster listet die Regler von der obersten Zone der
Tastatur (oben in der Liste) bis zur untersten (unten in der Liste).
**Zone 1** ist die oberste Zone, Zone 2 die nächste darunter
und so weiter. **Split Point N** ist die Grenze zwischen Zone N
und Zone N+1. Wenn du **Number of Splits** erhöhst, erscheinen
weitere Zeilen am Ende der Liste (= eine neue Zone am unteren Ende
der Tastatur); wenn du es verringerst, verschwinden sie wieder.

| Regler | Wirkung |
|---|---|
| **Number of Splits** | Wie viele Splitpunkte aktiv sind (1–3). Ein Split ergibt zwei Zonen, zwei Splits drei und so weiter. Die Zeilen für nicht benötigte Splits und Zonen werden ausgeblendet. |
| **Zone N Channel** | Der MIDI-Kanal, auf dem Noten der Zone N gesendet werden. Voreinstellungen: `1, 2, 3, 4` — Zone 1 (die oberste Zone, typisch das Obermanual oder die rechte Melodiehand) liegt konventionell auf Kanal 1. |
| **Zone N Transpose** | Zone N in ganzen Oktaven nach oben oder unten verschieben. Typisch für die unterste Zone in einem Hammond-Setup: `-1`, damit deine linke Hand am eingestrichenen C den unteren Bereich des Untermanuals spielt. |
| **Split Point N** | Die Note, an der Split N die Tastatur teilt. `60` ist das eingestrichene C. Eine Note exakt auf einem Splitpunkt geht in die Zone oberhalb. Die Nummerierung gibt keine Reihenfolge der Tonhöhen vor — wenn du Split Point 2 über Split Point 1 setzt, sortiert das Skript intern. |
| **Floating Range Above N / Floating Range Below N** | **Experimentell — beide bitte auf `0` lassen.** Werte größer als `0` aktivieren einen "smarten Split", bei dem jede Zone ein paar Halbtöne über die Linie greift; dieser Modus hat bekannte Fehler bei Akkorden. Siehe [Experimentell: Floating Ranges](#experimentell-floating-ranges) am Ende. |

### Sinnvolle Startwerte

Lass in allen Beispielen unten Floating Range Above und Below auf
jedem Split bei `0` (harte Linie). Die smarte Variante ist
experimentell — siehe den Abschnitt am Ende.

- **Hammond-Orgel mit zwei Manualen** — Number of Splits `1 split
  (2 zones)`, Split Point 1 `60`. Die Voreinstellungen geben Zone 1
  (Obermanual) Kanal `1` und Zone 2 (Untermanual) Kanal `2`. Zone
  2 Transpose auf `-1`.
- **Klavier rechts, Bass links** — Number of Splits `1 split (2
  zones)`, Split Point 1 etwa `48` (das C unterhalb des
  eingestrichenen C). Zone 2 Transpose `-1` oder `-2`, falls
  nötig.
- **Hammond mit Basspedal-Bereich** — Number of Splits `2 splits (3
  zones)`, Split Point 1 etwa `60` (zwischen Ober- und Untermanual),
  Split Point 2 etwa `48` (zwischen Untermanual und Bass).
  Voreinstellungen: Zone 1 (Obermanual) Kanal `1`, Zone 2
  (Untermanual) Kanal `2`, Zone 3 (Bass) Kanal `3`. Zone 3
  Transpose `-2`, falls dein Basssound unterhalb deiner Handlage
  sitzt.
- **Sound-Effekte auf den obersten Tasten** — Split Point 1 auf etwa
  `96`–`108` setzen (trennt die FX-Zone von allem darunter) und den
  Kanal von Zone 1 einem separaten FX-Instrument zuweisen.

## Empfänger-Plug-in einrichten

Das Plug-in leitet das MIDI nur auf mehrere Kanäle. Du musst dem
Empfänger-Plug-in noch sagen, welcher Klang auf welchem Kanal
antworten soll — und das Plug-in muss auf demselben Channel-Strip wie
Scripter liegen, weil Scripter das MIDI nur in die Plug-ins darunter
auf seinem eigenen Strip einspeist.

**Für IK Hammond / Vintage B3 / Blue3:** Öffne die MIDI-Einstellungen
des Plug-ins und stelle jedes Manual auf den Kanal, der in der
entsprechenden Zone-Zeile oben steht.

**Für einen multitimbralen Sampler:** Ordne jeden Klang dem Kanal der
Zone zu, die ihn auslösen soll.

## Fehlersuche

**Es kommt nichts oder nur ein Teil der Zonen ist zu hören.**
Prüfe den MIDI-Empfangskanal deines Instruments. In den
Scripter-Parametern siehst du, auf welchen Kanal jede Zone sendet —
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

**Noten springen manchmal in die falsche Zone.**
Stell sicher, dass Floating Range Above und Below auf jedem Split
auf `0` stehen. Werte größer als `0` aktivieren die experimentelle
Smart-Split-Logik, die [bekannte Fehler](KNOWN_ISSUES.md) bei
Akkorden hat.

**Wo finde ich die aktuelle Datei?**
Die aktuelle Version von `scripter-keyboard-split.js` liegt im
Hauptverzeichnis dieses Repositories. Über den "Raw"-Button bei
GitHub kannst du den Inhalt direkt kopieren oder das ganze Repository
als ZIP herunterladen.

## Experimentell: Floating Ranges

> **Experimentell und fehlerhaft.** Die Smart-Split-Logik, die
> durch Floating Ranges größer als `0` aktiviert wird, hat offene
> Fehler bei Akkord-Eingaben — siehe
> [KNOWN_ISSUES.md](KNOWN_ISSUES.md). Lass für zuverlässiges
> Verhalten Floating Range Above und Below auf jedem Split bei
> `0`. Der Rest dieses Abschnitts beschreibt, was der smarte Split
> *zu leisten versucht*; überspring ihn, wenn du nur harte Splits
> brauchst.

Jeder Splitpunkt hat eine **Floating Range Above** und **Floating
Range Below** in Halbtönen. Beide auf `0` ergeben einen harten Split
— Noten ab dem Splitpunkt aufwärts gehen in die obere Zone, darunter
in die untere — und der Rest dieser README setzt das voraus.

Auf ein paar Halbtöne gesetzt soll der Split jeder Hand unabhängig
folgen: Jede Hand "hält" ihre Seite der Tastatur innerhalb der
Floating Range, auch wenn ihre Noten kurz in die andere Zone
hinüberreichen.

Das Prinzip lässt sich gut am zweihändigen Orgelmuster zeigen.
Stell dir vor, deine rechte Hand spielt `E4, D4, C4, H3` (MIDI-
Noten `64, 62, 60, 59`), während die linke Hand zwischen jedem
rechten Anschlag ein `E3` (Note `52`) tritt. Das Skript sieht
also:

```
64, 52, 62, 52, 60, 52, 59
```

Mit einem **harten Split bei Note 60** (Floating Ranges `0 / 0`)
landet das letzte `59` auf dem Untermanual — dein rechtes H springt
mitten in der Phrase auf die falsche Manualreihe.

Mit **Floating Range Above und Below auf 3** reicht jede Zone `3`
Halbtöne über den Splitpunkt hinaus. Beide Zonen können die Noten
zwischen `57` und `63` für sich beanspruchen, und es gewinnt die
mit der näher liegenden letzten Note. Die rechte Hand bewegt sich
um `60–64`; das `59` ist näher am rechten `60` als am linken `52`,
und die Melodie bleibt geschlossen auf dem Obermanual.

Dieser Teil funktioniert. Das ungelöste Problem sind Akkorde:
"gleichzeitig" gespielte Noten werden über MIDI als Folge einzelner
NoteOn-Events in unbestimmter Reihenfolge geliefert, und genau die
gleiche Folge-der-Hand-Logik, die im monophonen Fall hilft,
zerstreut die Stimmen eines Akkords über die Zonen. Siehe
[KNOWN_ISSUES.md](KNOWN_ISSUES.md) für die Reproduktion und
Details.

## Lizenz

MIT — siehe [LICENSE](LICENSE).

---

## Implementierungsdetails

*Der folgende Abschnitt richtet sich an Neugierige oder Entwickler.
Um das Plug-in einfach zu benutzen, brauchst du nichts davon.*

### Wie der Algorithmus funktioniert

- Die Tastatur wird von N Splitpunkten in N+1 Zonen geteilt. Der
  Router indiziert sie null-basiert nach Tonhöhe — Router-Zone 0
  ist die tiefste Tonhöhenzone, Router-Zone N die höchste. (Die
  UI-Beschriftung läuft anders herum: UI Zone 1 = Router-Zone N
  = oben, UI Zone N+1 = Router-Zone 0 = unten. Das Wrapper-
  Skript übersetzt das in `rebuildCache`.) Jeder Splitpunkt hat eine
  Floating Range Above und Below (in Halbtönen).
- Jede Zone hat eine **Claim Zone** in Tonhöhen. Die obere Grenze
  einer unteren Zone ist `splitPoint + above` wenn `above > 0`, und
  `splitPoint − 1` wenn `above = 0` — der Splitpunkt selbst gehört
  also bei einem harten Split eindeutig zur oberen Zone:
    - Zone 0: `(-∞, upperEdge_0]`
    - Zone k (Mitte): `[splitPoints[k-1] − below_{k-1}, upperEdge_k]`
    - Zone N: `[splitPoints[N-1] − below_{N-1}, +∞)`
  Eine Zone kann eine Note nur dann für sich beanspruchen, wenn
  die Note in ihrer Claim Zone liegt — die Floating Range ist eine
  harte Obergrenze für die Reichweite einer Zone.
- Für jede eingehende Note:
  1. Sammle alle Zonen, deren Claim Zone die Note enthält.
  2. **Folge der Hand:** Ist die Zone der *vorherigen* Note dabei,
     bleibt die neue Note bei ihr — es sei denn, die zuletzt
     geroutete Note einer anderen Zone liegt um mehr als einen
     kleinen Puffer von Halbtönen näher als die vorherige. So bleibt
     eine durch die aktive Zone laufende Melodie dort, ohne dass
     eine veraltete oder zufällig passende letzte Note der anderen
     Zone sie hinüberzieht — während eine deutlich näher liegende
     andere Hand die Note durchaus zurückerobern kann (z.B. beim
     zweihändigen Orgelmuster, wo die letzte Note der anderen Zone
     viel näher liegt als die gerade gespielte).
  3. Sonst gewinnt die Zone, deren zuletzt geroutete Note in
     Halbtönen am nächsten liegt; Zonen ohne letzte Note gelten
     als unendlich weit weg; bei Gleichstand gewinnt die höhere
     Zone.
- **Harter Split** ist derselbe Algorithmus mit beiden Ranges eines
  Splits auf 0: Die Claim Zone der unteren Zone endet bei
  `splitPoint − 1`, die der oberen beginnt bei `splitPoint`, und
  der Splitpunkt gehört eindeutig zur oberen Zone. Harte und
  smarte Splits dürfen in einer Konfiguration gemischt werden, aber
  der Smart-Split-Pfad (jeder Range > 0) ist experimentell und
  routet Akkord-Eingaben bekanntermaßen falsch — siehe
  [KNOWN_ISSUES.md](KNOWN_ISSUES.md).
- **Note-to-Channel-Zuordnung**: Ein `noteToChannel[0..127]`-Array
  merkt sich, auf welchem Kanal jedes Note On gesendet wurde, damit
  das passende Note Off immer auf demselben Kanal landet — auch wenn
  zwischendurch das Split-Layout geändert wurde.
- **Hot-Path-Disziplin**: `HandleMIDI` läuft bei jedem MIDI-Event.
  Der gesamte Routing-Zustand liegt in einem `cache`-Objekt, das
  ausschließlich in `rebuildCache` an Ort und Stelle mutiert wird —
  und das nur bei einer Parameteränderung. Der Cache enthält neben
  den sortierten Splitpunkten auch vorausberechnete Claim-Grenzen
  pro Zone (`cache.lowerBounds[k]` / `cache.upperBounds[k]`), die
  Kanal- und Transponier-Tabellen pro Zone und ein dedupliziertes
  Failsafe-Set. Der Router liest die Grenzen direkt — keine
  Arithmetik im Hot Path, keine Allokationen pro Event, keine
  `GetParameter`-Aufrufe. Selbst `rebuildCache` allokiert nach dem
  Warmup nichts mehr: die Sortier-Scratchpuffer werden einmal beim
  Script-Laden angelegt und wiederverwendet.

### Aufbau des Projekts

| Datei | Zweck |
|---|---|
| `split-router.js` | Die alleinige Quelle für den N-Zone-Routing-Algorithmus. Reines JavaScript ohne Scripter-Abhängigkeiten — voll unit-testbar. |
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
