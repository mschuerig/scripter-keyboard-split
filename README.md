[English](README.md) · [Deutsch](README.de.md)

# scripter-keyboard-split

A script for the **MainStage / Logic Pro Scripter plugin** that divides
your MIDI keyboard into up to four zones and sends each to its own
MIDI channel — so you can play, for example, the upper and lower manual
of a Hammond organ on one keyboard, with a split that doesn't get in
the way of two-handed playing. Add a third or fourth zone when you
want a bass pedal zone, a lead patch, or a handful of keys dedicated to
sound effects.

> **Early-stage script.** Hard splits (Floating Range Above and Below
> both set to `0`) should be rock-solid — that's just a fixed line on
> the keyboard. The smart-split logic with nonzero floating ranges is
> newer and can still surprise you in edge cases. If you hit
> unexpected routing mid-phrase, the quickest workaround is to set
> that split's Floating Range Above and Below to `0`.

## Why you might want it

- The split functionality built into some virtual instrument plugins is limited:
  it draws one fixed line on the keyboard.
- MainStage always sends splits to separate channel strips, even if they could
  and should be handled by a single plugin.

Each split has a **Floating Range** above and below it. Set both to
`0` for a classic hard split — a fixed line on the keyboard. Set them
to a few semitones for a **smart split** that follows what each of
your hands is doing independently: each hand "holds" its side of the
keyboard within that floating range even when the notes briefly cross
over into the other zone. You can mix hard and smart splits in the
same setup.

## What you need

- **Logic Pro** or **MainStage** (any recent version that includes
  Scripter — i.e. Logic Pro 10+ / MainStage 3+).
- A plugin on the same channel strip that can play different sounds
  on different MIDI channels. (Scripter only sends MIDI down its own
  channel strip — it can't route to a different track.) Typical
  examples:
    - The **IK Multimedia Hammond 3-BX** plugin (route upper/lower manuals
      by MIDI channel).
    - Native Instruments **Vintage Organs**, GG Audio **Blue3**, or any
      organ plugin with a channel-based split.
    - Two or more separate instrument tracks/channel strips, each set
      to receive on a different MIDI channel.
    - A multi-timbral sampler with parts assigned to different MIDI
      channels.

## Installation

1. Download **`scripter-keyboard-split.js`** from this repository.
2. In MainStage (or Logic), open the channel strip with the instrument
   you want to split.
3. Add **Scripter** as a MIDI FX, **above** the instrument plugin.
   *(Channel strip → MIDI FX slot → Scripter)*
4. Click **Open Script Editor**.
5. In any text editor, open `scripter-keyboard-split.js`. Select all
   (⌘A), copy (⌘C).
6. In the Script Editor, select all of the existing example code and
   paste your copy in place of it.
7. Click **Run Script**. The control knobs and menus appear in the
   Scripter window.
8. Configure your receiving instrument to listen on the channels you
   chose (see below) and you're ready to play.

## The controls

The Scripter window lists controls from the highest zone of the
keyboard at the top to the lowest at the bottom. **Zone 1** is the
highest zone, Zone 2 the next one down, and so on. **Split Point
N** is the boundary between Zone N and Zone N+1. Increasing
**Number of Splits** reveals more rows at the bottom of the list (=
adds a new zone at the bottom of the keyboard); decreasing it hides
them.

| Control | What it does |
|---|---|
| **Number of Splits** | How many split points are active (1–3). One split gives two zones, two splits give three, and so on. The rows for splits and zones you aren't using are hidden. |
| **Zone N Channel** | The MIDI channel notes assigned to Zone N are sent on. Defaults: `1, 2, 3, 4` — Zone 1 (the topmost zone, typically the upper manual or the main melody hand) is on channel 1 by convention. |
| **Zone N Transpose** | Shift Zone N up or down by whole octaves. Common choice for the bottom zone with a Hammond setup: `-1`, so your left hand at middle C plays the lower end of the lower manual. |
| **Split Point N** | The note where split N divides the keyboard. `60` is middle C. A pitch equal to a split point goes to the zone above it. The numbering does not impose pitch order — if you set Split Point 2 above Split Point 1, the script sorts them internally. |
| **Floating Range Above N / Floating Range Below N** | How many semitones above/below Split Point N the adjacent zones are allowed to claim. This is a hard upper bound on each zone's reach — a zone cannot extend past its floating range, no matter where its last-played note was. **Both set to 0** = a hard, fixed split. Larger numbers = each zone is willing to claim more pitches past the line, and the closer-last-pitch wins inside the overlap zone. |

### Sensible starting points

- **Hammond-style organ, two manuals** — Number of Splits `1 split
  (2 zones)`, Split Point 1 `60`, Floating Range Above 1 = Floating
  Range Below 1 = `3`. Defaults already give Zone 1 (upper manual)
  channel `1`, Zone 2 (lower manual) channel `2`. Set Zone 2
  Transpose to `-1`.
- **Piano right, bass left** — Number of Splits `1 split (2
  zones)`, Split Point 1 around `48` (C below middle C), Floating
  Range Above 1 = Floating Range Below 1 = `0` (hard split). Zone 2
  Transpose `-1` or `-2` if needed.
- **Hammond with a bass pedal zone** — Number of Splits `2 splits (3
  zones)`, Split Point 1 around `60` (between upper and lower
  manuals), Split Point 2 around `48` (between lower manual and
  bass). For the manual split (Split 1) try Floating Range `3 / 3`;
  for the bass split (Split 2) try Floating Range `0 / 0` — a hard
  boundary so the bass never leaks up. Defaults give Zone 1 (upper
  manual) channel `1`, Zone 2 (lower manual) channel `2`, Zone 3
  (bass) channel `3`. Zone 3 Transpose `-2` if the bass patch sits
  below where your hand falls.
- **Sound effects on the top few keys** — set Split Point 1 to about
  `96`–`108` (separating the FX zone from everything below), set its
  floating ranges to `0 / 0` (hard line), and assign Zone 1's
  channel to a separate FX instrument.

## Setting up the receiving plugin

The plugin just routes MIDI to several channels. You still need to
tell the receiving plugin which sound goes on which channel — and the
plugin has to live on the same channel strip as Scripter, because
Scripter only feeds MIDI into the plugins below it on its own strip.

**For the IK Hammond / Vintage B3 / Blue3:** open the plugin's MIDI
settings and set each manual to the channel shown in the matching
Zone row above.

**For a multi-timbral sampler:** assign each sound to the channel of
the zone that should trigger it.

## A worked example: why a smart split matters

Imagine your right hand walks a melody down — `E4, D4, C4, B3` (MIDI
notes `64, 62, 60, 59`) — while your left hand pedals an `E3` (note
`52`) between each right-hand note. So you actually play:

```
64, 52, 62, 52, 60, 52, 59
```

With a **hard split at note 60** (Floating Ranges `0 / 0`):
- `64` → upper ✓
- `52` → lower ✓
- `62` → upper ✓
- `52` → lower ✓
- `60` → upper ✓
- `52` → lower ✓
- `59` → **lower** ✗ — your right-hand B suddenly jumps to the lower
  manual mid-phrase.

With **Floating Range Above and Below set to 3**, each zone's claim
extends `3` semitones past the split — so both zones can claim the
notes between `57` and `63`, and the one whose recent note is closer
in semitones wins. The right hand has been hovering around `60–64`,
so when the `59` comes in, it's closer to the right-hand `60` than to
the left-hand `52`, and the melody stays intact on the upper manual.

The same logic extends to more splits: each zone tracks its own
recent note independently, so a left-hand walking bass below a chord
voicing above a right-hand melody all hold their lanes.

## Troubleshooting

**Nothing comes out, or only some zones sound.**
Check the MIDI channel of your receiving instrument. The Scripter
parameters show the channel each zone is sent on; the instrument
has to be listening to that exact channel.

**A note hangs.**
Quickest fix — send a MIDI panic:
- **MainStage**: *Actions → Panic* (⌃P).
- **Logic Pro**: see [Apple's guide](https://support.apple.com/en-us/guide/logicpro/lgcpc412346d/mac).

The script tracks every Note On so the matching Note Off goes to the
same channel even if the split moves. Hangs are rare — usually only
if the script was started while a key was already held.

**Notes occasionally jump to the wrong zone.**
Try smaller Floating Ranges — the larger the range, the more the
plugin is willing to claim past a split. If you mostly play distinct
hand parts that never cross, set the floating ranges to `0` for that
split.

**Where do I download the file?**
The latest version of `scripter-keyboard-split.js` is in this
repository's root. Use the GitHub "Raw" button to copy it, or
download the repository as a ZIP.

## License

MIT — see [LICENSE](LICENSE).

---

## Implementation details

*The section below is for the curious or for contributors. You don't
need any of this to use the plugin.*

### How the algorithm works

- The keyboard is divided by N split points into N+1 zones. The
  router indexes them zero-based by pitch — router zone 0 is the
  lowest pitch range, router zone N is the highest. (The UI labels
  these in the opposite order: UI Zone 1 = router zone N = top,
  UI Zone N+1 = router zone 0 = bottom. The wrapper translates
  between them in `rebuildCache`.) Each split has a Floating Range
  Above and Below (in semitones).
- Each zone has a **claim zone** in pitch:
    - Zone 0: `(-∞, splitPoints[0] + above_0]`
    - Zone k (middle): `[splitPoints[k-1] − below_{k-1}, splitPoints[k] + above_k]`
    - Zone N: `[splitPoints[N-1] − below_{N-1}, +∞)`
  A zone can claim a pitch only if the pitch lies within that claim
  zone — the floating range is a hard upper bound on how far the
  zone reaches past a split.
- For each incoming pitch:
  1. Gather every zone whose claim zone contains the pitch.
  2. **Follow the hand:** if the *previous* note's zone is among
     them, it keeps the new note — unless another candidate's
     last-played pitch is more than a small buffer of semitones
     closer than prev's. This keeps a melodic line continuing
     through the active zone from being yanked across by a stale
     or coincidentally-matching last-pitch on the other side, while
     still letting a clearly-closer other hand reclaim the note (the
     two-handed organ pattern, where the other zone's recent note
     is far closer than the freshly-played one).
  3. Otherwise the zone whose last-played pitch is closest in
     semitones wins; zones with no last pitch are treated as
     infinitely far away; ties go to the higher zone index.
- **Hard split** is the same algorithm with both ranges of a split
  set to 0: the two adjacent zones' claim zones meet at the split
  point with no overlap (except the split point itself, which the
  tie-break sends to the upper zone). Hard and smart splits can be
  mixed in the same configuration.
- **Note-to-channel mapping**: a `noteToChannel[0..127]` array
  remembers which channel each Note On was sent on, so the matching
  Note Off always lands on the same channel even if the user has
  meanwhile changed the split layout.
- **Hot-path discipline**: `HandleMIDI` runs on every incoming MIDI
  event. All routing state lives in a `cache` object that is mutated
  in place by `rebuildCache`, which runs only when the user touches a
  knob. The cache holds the sorted split points alongside
  pre-computed per-zone claim bounds (`cache.lowerBounds[k]` /
  `cache.upperBounds[k]`), the zone channel / transpose lookup
  tables, and a deduplicated failsafe channel set. The router reads
  the precomputed bounds directly — no arithmetic on the hot path,
  no per-event allocations, no `GetParameter` calls. Sorting uses
  scratch arrays allocated once at script load so even `rebuildCache`
  itself doesn't allocate after warm-up.

### Project layout

| File | Purpose |
|---|---|
| `split-router.js` | Single source of truth for the N-zone routing algorithm. Pure JS, no Scripter dependencies — fully unit-testable. |
| `split-router.test.js` | Bun test suite covering single- and two-split configurations, hard vs. smart split, mixed splits, defensive sort, and the transposition helper. |
| `scripter-keyboard-split.template.js` | Hand-edited Scripter wrapper. Holds the `MAX_SPLITS` constant, parameter generator, cache, and `ParameterChanged` / `HandleMIDI`. Includes an `@inject:split-router` marker block. |
| `build.js` | Strips `export ` from `split-router.js` and inlines it into the template marker. |
| `scripter-keyboard-split.js` | Generated by `bun run build`. This is the file users paste into Scripter. Committed so users don't need to run the build themselves. |

The router has no built-in cap on the number of split points; raising
the UI cap is a single edit to `MAX_SPLITS` in the template.

### Developing

```bash
bun install       # no runtime deps, but creates lockfile
bun test          # run the routing test suite
bun run build     # regenerate scripter-keyboard-split.js
```

GitHub Actions runs `bun test` on every push and pull request — see
`.github/workflows/test.yml`.

### Contributing

If you change the routing algorithm:
1. Edit `split-router.js` and add a test in `split-router.test.js`.
2. Run `bun test` and confirm it passes.
3. Run `bun run build` and commit the regenerated
   `scripter-keyboard-split.js` alongside your changes.

If you change the Scripter wrapper (parameter list, MIDI handling),
edit `scripter-keyboard-split.template.js`, then rebuild.
