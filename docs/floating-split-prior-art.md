# Floating-split prior art

How other people have solved (or failed to solve) the problem documented
in [`KNOWN_ISSUES.md`](../KNOWN_ISSUES.md): a keyboard split where notes
near the boundary are routed by context — what was played just before,
which hand is active — rather than by a fixed pitch cut, and how that
breaks when MIDI delivers a chord's notes one at a time in an arbitrary
order.

This is a survey of approaches and a recommendation for which one to
adapt if smart-split mode is ever taken out of "experimental."

## TL;DR

- **Hardware workstations don't solve it.** Roland, Korg, and Nord all
  treat the boundary as a static pitch cut or as an audio-domain
  crossfade in which both zones sound simultaneously at attenuated
  levels. None makes a context-aware MIDI routing decision.
- **MainStage's own "Floating Split Point" has the same bug we do.**
  The algorithm is the same windowed-overlap rule. Apple's documentation
  doesn't mention chord input at all.
- **The only shipping tool that solves it** is
  [Musikraken Chord Splitter][musikraken]: it buffers NoteOns for a
  configurable delay after the first one arrives, then routes the whole
  group as one decision.
- **The academic backing** is McLeod & Steedman's HMM voice separator,
  which observes simultaneous-onset notes as a set and assigns them
  jointly in one Viterbi step.
- **Recommendation:** if we revive smart-split mode, do
  buffer-then-decide on notes inside the floating range only (so latency
  hits only ambiguous events), optionally layered with a two-tracker
  hand model on the buffered group.

## 1. Hardware workstations

| Vendor / model | Marketing term | What it actually is |
|---|---|---|
| Roland Fantom | Key Range Fade | Audio crossfade. Documented as "the degree to which the partial is sounded" — a level control, not a router. |
| Korg Kronos | Key Zone Slopes | Audio crossfade. "Gradually fade a sound in or out over a range of keys" with both timbres overlapping. |
| Nord Stage 3 | Split Width (Off / Sml / Lrg) | Audio crossfade. `Lrg` reaches "6 notes above" the split point with the lower sound. Explicitly **does not apply to the Extern (external MIDI) section**, confirming it's an audio-engine effect. |

Targeted searches across these vendors' parameter guides for "smart
split," "floating split," "context split," and "hand detection"
returned zero matches. Yamaha Montage/CP/MODX, Kurzweil Forte, and
Studiologic Numa weren't surveyed in depth — absence of evidence, not
evidence of absence — but their marketing copy doesn't mention anything
along these lines either.

The takeaway: when workstations want to soften a split, they do it in
the audio domain by playing both zones at once. They sidestep the
routing decision rather than make it smarter. That's a viable strategy
inside a single instrument — but it's not what this script does. We route
MIDI to separate channels, so we have to actually pick one.

**Sources:** Roland Fantom Parameter Guide; Korg Kronos Operation
Guide; Nord Stage 3 User Manual.

## 2. Software hosts

**Apple MainStage** (the host we run inside) ships "Low Key Floating /
High Key Floating" sliders in the Layer Editor. The rule, from Apple's
docs:

> notes that define the boundaries... change depending on the keys you
> play as you approach the boundary.

The worked example: ascending G0–A0–B0 then C1–D1 pulls the boundary up
to include C1 and D1 (within the floating window) but not E1. That is
exactly the sticky-zone rule this script implements, and Apple's
documentation never discusses how simultaneous chord NoteOns are
handled. So MainStage's built-in feature is functionally identical to
ours and almost certainly has the same chord-arrival-order failure
mode. Apple confirms the bug exists upstream; it does not offer a fix.

**Gig Performer** ships only static pitch-range splits. A community
feature-request thread titled "Dynamic Keyboard Split" opens with "In
GigPerformer the splitpoint is fixed" and ex-MainStage users describe
the exact use case: "left hand bass and right hand piano and
occasionally some bass riff needs a note above the split point." No
Scriptlet implementation has been posted. The problem is known and
unsolved in mainstream host software.

**Musikraken Chord Splitter** is the one shipping tool that solves it
correctly. It exposes a `chord detection delay` parameter and
documents the rationale verbatim:

> This is the delay that this module waits after a note-on is received
> until it detects a chord and distributes the notes to the channel...
> if you use an input device like a keyboard, not all notes of a chord
> will be played exactly at the same time. So in order to distribute
> the notes to the correct channel, there needs to be some delay.

The tool also exposes an adaptive `Minimal detection delay` that
shortens the wait when the active note count matches the previous
chord — a latency optimization worth stealing. Musikraken's downstream
use is different from ours (it splits a chord by role — root, third,
fifth — across channels, not by hand), but the buffer-then-decide
pattern at the front end is identical.

**Sources:** Music Teacher Magazine MainStage review; Apple support
docs; Gig Performer documentation and community forum; Musikraken
website.

## 3. Academic backing

The piano-transcription and music-information-retrieval communities have
worked on essentially the same problem offline: given a stream of MIDI
notes, separate them into left/right hand parts or independent voices.
Several of these approaches are causal enough to be relevant.

**McLeod & Steedman**, *HMM-Based Voice Separation* (Edinburgh), is
the most directly applicable. Section 3.2 of the paper:

> If multiple notes have equal onset time, they are observed as a set.

The joint transition probability includes an explicit `order(S, n_i, w_i)`
factor that penalizes pitch-order violations between simultaneous
notes — so the chord is routed coherently rather than note-by-note.
Inference uses a modified Viterbi with beam search (beam 25 at test, 10
in training), is incremental, and the paper claims real-time
feasibility. Caveat: the paper assumes *exactly* equal onset times, not
a tolerance window. Adapting it to live MIDI means picking that window
ourselves.

**Cambouropoulos** (*Music Perception* 26(1), 2008) redefines voice
separation around auditory streaming and argues that a "voice" can be a
chord that fuses into one auditory stream. This is the theoretical
justification for treating a whole chord as the decision unit:
homophonic textures don't form independent lines in perception, so
deciding the chord as a unit isn't a compromise — it's the correct
formulation.

**Hadjakos & Lefebvre-Albaret** (SMC 2009),
*Three Methods for Pianist Hand Assignment*, propose a Kalman-filter
tracker: two filters, one per hand, each maintaining a pitch-position
estimate over time; each incoming note is assigned to whichever filter
is the better predictor for its pitch. This is the lightest "learned"
approach, reduces to a per-hand running mean and spread, and would fit
inside Scripter's `ParameterChanged` cache.

**Hadjakos, Waloschek & Leemhuis** (2019, cemfi.de) demonstrate an RNN
that does the same thing in real time via OSC, with a documented
accuracy/latency tradeoff (~92.8–93.3% causal vs ~93.1–94.6%
bidirectional). One of the stated target applications is exactly the
dynamic-split use case: "different synthesizer sounds can be mapped to
the left and right hand." Precedent that learned hand assignment works
in real time, but unlikely to fit inside Scripter's JS sandbox.

**Chew & Wu** *contig mapping* is the most-cited alternative voice
separator. It segments the whole piece by voice count and reconnects
contigs outward from maximal-voice regions in `O(n²)`. Follow-up
literature explicitly notes it can't run on live input. Useful as
inspiration for a "wait until you can tell" heuristic, not portable as
an algorithm.

**Sources:** McLeod & Steedman, *Voice Separation* (Edinburgh);
Cambouropoulos, *Voice and Stream: Perceptual and Computational Modeling*
(*Music Perception* 26(1):75–94); Hadjakos & Lefebvre-Albaret, *Three
Methods for Pianist Hand Assignment* (SMC 2009); Hadjakos, Waloschek,
Leemhuis, *Detecting Hands from Piano MIDI Data* (2019); Chew & Wu,
*Separating Voices in Polyphonic Music: A Contig Mapping Approach*.

## 4. Scripter feasibility

Scripter's event API exposes:

- `Event.send()` — send immediately,
- `Event.sendAfterMilliseconds(ms, …)` — `ms` is a float, no setTimeout
  needed,
- `Event.sendAtBeat(…)` / `Event.sendAfterBeats(…)` — tempo-relative.

There is no `setTimeout` and no Node/browser globals. A
buffer-then-decide implementation is therefore feasible: capture a
NoteOn in `HandleMIDI`, schedule a deferred emit via
`sendAfterMilliseconds`, accumulate further NoteOns that arrive before
the deadline into the same group, route the whole group when the
deadline fires.

Any approach that needs timer-driven polling, threads, or external IPC
is out. Anything that fits inside the `HandleMIDI` /
`ParameterChanged` / `sendAfterMilliseconds` budget is in.

**Sources:** Apple Logic Pro Scripter docs; musios-app/logic-pro-scripter
community reference.

## 5. What to steal

In order of how directly the evidence supports them.

### 5.1 Buffer-then-decide (primary)

A NoteOn that falls inside the floating range doesn't route
immediately. It goes into a per-split "pending group" and schedules a
deferred emit via `sendAfterMilliseconds(8)` (or whatever window we
end up tuning). Further NoteOns arriving within the window join the
same group. When the deadline fires, the whole group routes as one
decision — by group centroid, by majority vote against the current
hand position, or by whatever rule we pick. Notes outside the
floating range bypass the buffer entirely, so latency hits only the
genuinely ambiguous events.

Precedent: Musikraken (shipping) and McLeod & Steedman (paper). Fit
to Scripter: clean.

Open design questions:

- **Window length.** Musikraken makes it user-configurable and ships
  without a published default for keyboard input. 5–15 ms is the typical
  human-chord spread but is our own guess, not from a cited source.
- **Note-Off handling for buffered notes.** A NoteOff for a note still
  in the pending group has to be held back too, or the group will see a
  zero-length note. Same for sustain pedal interactions.
- **Adaptive window.** Musikraken shortens the wait when the active
  note count matches the previous chord. Worth copying once the basic
  version works.

### 5.2 Two-tracker hand model (layered on 5.1)

Maintain a small per-hand running pitch estimate (EMA plus spread).
When the buffered group fires, pick the hand whose predictor better
fits the group's centroid. Handles the case where a chord sits squarely
inside the overlap band by leaning on prior-hand context.

This is essentially what the current single-pass code attempts per
note — but applied per group, which is what makes it work. Precedent:
Hadjakos & Lefebvre-Albaret. Fit to Scripter: lightweight; the
trackers live in the cache built by `ParameterChanged`.

### 5.3 Explicit pedal/button hand switching (escape hatch)

A sustain-style CC mapped to "force lower" / "force upper" that
overrides the auto-router for as long as it's held. No literature
backing — the research turned up no verified community-preference
survey — but it's the conventional live-keyboard answer when
auto-detection is uncertain. Cheap to implement; cheap to remove if
it's not used.

### Not worth pursuing

- **Retroactive correction** (route immediately, then send NoteOff and
  retransmit on the other channel if wrong): didn't surface in any
  source, would be audible as a click on hard attacks.
- **Chew & Wu contig mapping** and other global voice separators:
  offline-only.
- **Hadjakos 2019 RNN**: too heavy for Scripter's sandbox. Cite as
  precedent only.

## Caveats

- Musikraken is one tool, not an industry pattern. "Established
  practice" is supported by the evidence but isn't overwhelming.
- McLeod & Steedman assume exactly-equal onset times; the tolerance
  window is our design choice.
- Yamaha Montage/CP, Kurzweil Forte, and Studiologic Numa weren't
  surveyed in depth.
- The buffer-then-decide approach contradicts the
  "no latency in the hot path" instinct that drove the current
  single-pass design. Even 8 ms is detectable by some players on hard
  attacks. The right framing is probably a per-split mode switch
  (hard / floating-buffered / experimental-floating-instant) rather
  than replacing the existing behavior.

## Source index

- Musikraken Chord Splitter — <https://www.musikraken.com/chordsplitter.html>
- McLeod & Steedman, *Voice Separation* —
  <https://homepages.inf.ed.ac.uk/steedman/papers/music/VoiceSeparation.pdf>
- Cambouropoulos, *Voice and Stream* —
  <https://online.ucpress.edu/mp/article/26/1/75/62376/Voice-And-Stream-Perceptual-And-Computational>
- Hadjakos & Lefebvre-Albaret, *Three Methods for Pianist Hand Assignment* —
  <https://www.researchgate.net/publication/255583586_THREE_METHODS_FOR_PIANIST_HAND_ASSIGNMENT>
- Hadjakos, Waloschek, Leemhuis, *Detecting Hands from Piano MIDI Data* —
  <http://www.cemfi.de/wp-content/papercite-data/pdf/hadjakos-2019-detectinghands.pdf>
- Chew & Wu, *Contig Mapping* —
  <https://link.springer.com/chapter/10.1007/978-3-540-31807-1_1>
- Roland Fantom Parameter Guide —
  <https://static.roland.com/assets/media/pdf/FANTOM_ParameterGuide_eng01_W.pdf>
- Korg Kronos Operation Guide —
  <https://cdn.korg.com/us/support/download/files/2fd1d54ad1f6f5e32caa8f5cd622e565.pdf>
- Nord Stage 3 User Manual —
  <https://www.manualslib.com/manual/1279441/Nord-Stage-3.html?page=14>
- Gig Performer split docs —
  <https://gigperformer.com/how-to-create-keyboard-and-velocity-splits>
- Gig Performer community "Dynamic Keyboard Split" —
  <https://community.gigperformer.com/t/dynamic-keyboard-split/256>
- MainStage Floating Split Point (review) —
  <https://www.musicteachermagazine.co.uk/content/review/tech-reviews-orchestral-sounds-from-the-keyboard>
- Logic Pro Scripter community reference —
  <https://github.com/musios-app/logic-pro-scripter>

[musikraken]: https://www.musikraken.com/chordsplitter.html
