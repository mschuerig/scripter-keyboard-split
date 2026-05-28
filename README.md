[English](README.md) · [Deutsch](README.de.md)

# scripter-keyboard-split

A small **MainStage / Logic Pro Scripter plugin** that splits your MIDI
keyboard between two MIDI channels — so you can play, for example, the
upper and lower manual of a Hammond organ on one keyboard, with a split
that doesn't get in the way of two-handed playing.

## Why you might want it

The split built into the IK Multimedia Hammond plugin (and similar
plugins) is limited: it draws one fixed line on the keyboard. If your
right hand wanders down or your left hand reaches up, the split chops
melodies in half and the wrong manual answers.

This plugin offers two modes:

- **Fixed** — a classic hard split at a note you choose. Simple and
  predictable.
- **Floating** — a smart split that follows what each of your hands is
  doing independently. Each hand "holds" its side of the keyboard
  even when the notes briefly cross over into the other region.

## What you need

- **Logic Pro** or **MainStage** (any recent version that includes
  Scripter — i.e. Logic Pro 10+ / MainStage 3+).
- A plugin or setup that can play different sounds on different MIDI
  channels. Typical examples:
    - The **IK Multimedia Hammond** plugin (route upper/lower manuals
      by MIDI channel).
    - Native Instruments **Vintage Organs**, GG Audio **Blue3**, or any
      organ plugin with a channel-based split.
    - Two separate instrument tracks/channel strips, each set to
      receive on a different MIDI channel.
    - A multi-timbral sampler with two parts.

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
8. Configure your receiving instrument to listen on two MIDI channels
   (see below) and you're ready to play.

## The controls

Every setting is visible in the Scripter window once the script is
running. Hover or click each control to adjust it.

| Control | What it does |
|---|---|
| **Split Mode** | *Fixed* draws a hard line. *Floating* lets the line move with your playing so two-handed phrases stay intact. |
| **Base Split Point** | The note at the centre of the split. `60` is middle C. In Fixed mode, notes at or above go to the upper side. In Floating mode, this is where the floating range is anchored. |
| **Floating Range Above** | (Floating mode only.) How many semitones *above* the base split the upper region can claim a note. Larger = more forgiving. |
| **Floating Range Below** | (Floating mode only.) How many semitones *below* the base split the lower region can claim a note. |
| **Upper Region Channel** | The MIDI channel notes assigned to the upper region are sent on. Default `1`. Set your upper manual / upper instrument to receive on this channel. |
| **Lower Region Channel** | The MIDI channel notes assigned to the lower region are sent on. Default `2`. Set your lower manual / lower instrument to receive on this channel. |
| **Upper Region Transpose** | Shift the upper side up or down by whole octaves. Useful when the upper manual sound sits in a different range than where your hand plays. |
| **Lower Region Transpose** | Shift the lower side up or down by whole octaves. Common choice: `-1` so the left hand at middle C plays the low end of the lower manual. |

### Sensible starting points

- Hammond-style organ with two manuals: **Floating**, Base Split `60`,
  Floating Range Above/Below `3`, Upper Channel `1`, Lower Channel `2`,
  Lower Transpose `-1`.
- Piano on the right, bass on the left: **Fixed**, Base Split around
  `48` (C below middle C), Lower Transpose `-1` or `-2` if needed.

## Setting up the receiving plugin

The plugin just routes MIDI to two channels. You still need to tell
your instrument(s) which sound goes on which channel.

**For the IK Hammond / Vintage B3 / Blue3:** open the plugin's MIDI
settings and set the upper manual to receive on channel `1` and the
lower manual on channel `2` (or whatever channels you chose in the
controls above).

**For two separate plugin tracks:** put one instrument on each track,
set each track's MIDI input to "MIDI channel 1" / "MIDI channel 2",
and feed both from the channel strip carrying Scripter.

**For a multi-timbral sampler:** assign the upper and lower sounds to
the matching MIDI channels in the sampler's part list.

## A worked example: why Floating mode matters

Imagine your right hand walks a melody down — `E4, D4, C4, B3` (MIDI
notes `64, 62, 60, 59`) — while your left hand pedals an `E3` (note
`52`) between each right-hand note. So you actually play:

```
64, 52, 62, 52, 60, 52, 59
```

With a **Fixed split at note 60**:
- `64` → upper ✓
- `52` → lower ✓
- `62` → upper ✓
- `52` → lower ✓
- `60` → upper ✓
- `52` → lower ✓
- `59` → **lower** ✗ — your right-hand B suddenly jumps to the lower
  manual mid-phrase.

With **Floating mode**, the algorithm remembers where each hand has
been. The right hand has been hovering around `60–64`, so when the
`59` comes in, it goes to whichever recent note it's closest to — the
right-hand `60`, not the left-hand `52`. The melody stays intact on
the upper manual.

## Troubleshooting

**Nothing comes out, or only one side sounds.**
Check the MIDI channel of your receiving instrument. The Scripter
parameters say which channel each side is sent on; the instrument has
to be listening to that exact channel.

**A note hangs.**
The script tracks every Note On so the matching Note Off goes to the
same channel even if the split moves. If a note still hangs (rare —
usually only if the script was started while a key was already held),
toggle **Run Script** off and on, or play and release that note again.

**Notes occasionally jump to the wrong side in Floating mode.**
Try a smaller Floating Range — the larger the range, the more the
plugin is willing to "reach across" the split. If you mostly play
distinct hand parts that never cross, Fixed mode might just be
easier.

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

- **Fixed mode** is one line: `pitch >= baseSplit → upper`,
  otherwise lower.
- **Floating mode** keeps two pieces of state: the most recent pitch
  routed to the upper region (`lastPitchUpper`) and the most recent
  pitch routed to the lower region (`lastPitchLower`). For each new
  Note On, the algorithm asks: *can this note stay with the upper
  region's recent note (within the floating range)? Can it stay with
  the lower region's recent note?*
    - If only one region "claims" the note, it goes there.
    - If both regions claim it, the note goes to whichever recent
      note is closer in semitones.
    - If neither claims it, fall back to the fixed-split rule.
- **Note-to-channel mapping**: a `noteToChannel[0..127]` array
  remembers which channel each Note On was sent on, so the matching
  Note Off always lands on the same channel even if the user has
  meanwhile changed the split point or mode.

### Project layout

| File | Purpose |
|---|---|
| `split-router.js` | Single source of truth for the routing algorithm. Pure JS, no Scripter dependencies — fully unit-testable. |
| `split-router.test.js` | Bun test suite covering both Fixed and Floating modes, the two-handed alternation pattern, melody cohesion, crossover, and the transposition helper. |
| `scripter-keyboard-split.template.js` | Hand-edited Scripter file with an `@inject:split-router` marker block. |
| `build.js` | Strips `export ` from `split-router.js` and inlines it into the template marker. |
| `scripter-keyboard-split.js` | Generated by `bun run build`. This is the file users paste into Scripter. Committed so users don't need to run the build themselves. |

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
