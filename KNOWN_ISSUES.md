# Known Issues

## Floating range: chord notes scatter across zones

**Affects:** Floating Range Above and/or Below greater than `0` (the
"smart split" mode). Hard splits, where both ranges of a split are
set to `0`, are unaffected.

**Symptom.** A chord played within or near a smart-split's overlap
zone can be split across two channels — some notes go to the upper
zone, others to the lower — depending on:

1. what was played just before the chord, and
2. the order in which the chord's notes happen to arrive at the
   script.

The two zones use different MIDI channels (and possibly different
patches or transposes), so the split is audible as wrong notes or as
a missing voicing.

**Minimal reproduction.** One split at note `72`, Floating Range
Above = Below = `3`. The user plays:

```
67, <74, 78, 81>, <72, 76, 79>, <71, 75, 79>
```

— a single bass note, then three right-hand chords descending. Each
right-hand chord is a single hand's voicing and should go entirely
to the upper zone.

What actually happens:

| Event | Zone | Notes |
|---|---|---|
| `67` | lower | correct — clearly below the split |
| `74` | **lower** | wrong — pulled down by the just-routed `67` |
| `78` | upper | |
| `81` | upper | |
| `72` | **lower** | wrong — pulled down by `74` in the lower zone |
| `76` | upper | |
| `79` | upper | |
| `71` | **lower** | wrong — pulled down by `72` in the lower zone |
| `75` | **lower** | wrong — pulled down by `71` |
| `79` | upper | |

The bottom note of every chord lands on the wrong channel.

**Order dependency.** MIDI doesn't guarantee an order for the notes
of a chord — whichever key your finger touches a millisecond sooner
is sent first. The same chord played top-down does *not* trigger the
bug: with `<81, 78, 74>` instead of `<74, 78, 81>`, all three notes
go to the upper zone, because `81` and `78` pin the active zone to
upper before `74` is even considered. So the bug appearing on a
given chord depends on the controller and on physical playing
mechanics that the player can't control.

**Workaround.** Set the affected split's Floating Range Above and
Below to `0` (a hard split). The bug doesn't exist when both ranges
are `0`.

**Status.** Open. The router treats every NoteOn as an independent
decision and has no notion of "these notes arrived together". A
clean fix likely requires buffering NoteOns within a short window
(a few milliseconds) and routing the whole group as one decision —
which adds latency and complicates the hot path. Until that design
exists, smart-split mode is experimental: it works for monophonic
or sparse two-hand playing of the kind shown in the worked example
in the README, but is unreliable for chord input.
