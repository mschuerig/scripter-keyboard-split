import { describe, it, expect } from "bun:test";
import {
    routeNote,
    transposeByOctaves,
    routeNoteOn,
    routeNoteOff
} from "./split-router.js";

const R3 = { above: 3, below: 3 };
const R0 = { above: 0, below: 0 };

// Pre-compute the per-region claim bounds the same way the Scripter
// wrapper's rebuildCache does. Tests express layouts as user-facing
// (split points + ranges) and convert here.
function bounds(splits, ranges) {
    const N = splits.length;
    const idx = [];
    for (let i = 0; i < N; i++) idx.push(i);
    idx.sort((a, b) => splits[a] - splits[b]);
    const lo = new Array(N + 1);
    const hi = new Array(N + 1);
    lo[0] = -Infinity;
    hi[N] = Infinity;
    for (let i = 0; i < N; i++) {
        const p = splits[idx[i]];
        const r = ranges[idx[i]];
        hi[i] = p + r.above;
        lo[i + 1] = p - r.below;
    }
    return [lo, hi];
}

function runSequence(pitches, splits, ranges, lp) {
    const [lo, hi] = bounds(splits, ranges);
    let prev = -1;
    return pitches.map(p => {
        prev = routeNote(p, lo, hi, lp, prev);
        return prev;
    });
}

describe("routeNote — single split", () => {
    it("routes a pitch above the floating zone to the upper region", () => {
        const lp = [null, null];
        const [lo, hi] = bounds([60], [R3]);
        expect(routeNote(65, lo, hi, lp, -1)).toBe(1);
        expect(lp).toEqual([null, 65]);
    });

    it("routes a pitch below the floating zone to the lower region", () => {
        const lp = [null, null];
        const [lo, hi] = bounds([60], [R3]);
        expect(routeNote(55, lo, hi, lp, -1)).toBe(0);
        expect(lp).toEqual([55, null]);
    });

    it("handles the two-handed organ pattern 64, 52, 62, 52, 60, 52, 59", () => {
        const lp = [null, null];
        // Two distinct hands. Right hand opens at 64 (only r1 candidate).
        // Each left-hand 52 is forced to r0 (out of r1's claim). When
        // the right hand returns to a near-split pitch (62, 60, 59),
        // the prev-region rule does NOT fire (the step from 52 is
        // larger than the buffer), so closest-last-pitch wins and the
        // right hand at lp_r1=64 reclaims the note.
        expect(runSequence([64, 52, 62, 52, 60, 52, 59], [60], [R3], lp))
            .toEqual([1, 0, 1, 0, 1, 0, 1]);
    });

    it("keeps a descending melody together within the floating zone", () => {
        const lp = [null, null];
        // 70, 69, 68 are all above r0's claim ceiling (63), so r1 is
        // the only candidate — trivially in r1.
        expect(runSequence([70, 69, 68], [60], [R3], lp))
            .toEqual([1, 1, 1]);
    });

    it("allows crossover: closer last-pitch wins in the overlap zone", () => {
        const lp = [50, 62];
        const [lo, hi] = bounds([60], [R3]);
        // No prev set; closest-last-pitch picks r1 (dist 2 < 10).
        expect(routeNote(60, lo, hi, lp, -1)).toBe(1);
    });

    it("reassigns to lower if lower hand moves significantly closer", () => {
        const lp = [58, 62];
        const [lo, hi] = bounds([60], [R3]);
        // No prev; r0 dist=1, r1 dist=5 → r0.
        expect(routeNote(57, lo, hi, lp, -1)).toBe(0);
        expect(lp[0]).toBe(57);
    });

    it("ties go to the higher region index (upper wins on tie)", () => {
        const lp = [58, 62];
        const [lo, hi] = bounds([60], [R3]);
        // 60 ∈ both claim zones; dists both 2; no prev → higher index.
        expect(routeNote(60, lo, hi, lp, -1)).toBe(1);
    });

    it("does not extend a region past its floating range", () => {
        // Lower played 48; upper's claim is [57, ∞). A pitch of 56 is
        // outside upper's zone — upper cannot claim it.
        const lp = [48, null];
        const [lo, hi] = bounds([60], [R3]);
        expect(routeNote(56, lo, hi, lp, -1)).toBe(0);
    });

    it("follows the active hand back across the split (descending then bouncing)", () => {
        // A single hand walked 62→56; when it bounces back to 57, it
        // stays with the lower region (the hand that just played 56),
        // not the upper region whose stale lp=57 happens to match
        // exactly.
        const lp = [null, null];
        expect(runSequence([62, 61, 60, 59, 58, 57, 56, 57], [60], [R3], lp))
            .toEqual([1, 1, 1, 1, 1, 1, 0, 0]);
    });

    it("follows the active hand back across the split (ascending then bouncing)", () => {
        // Symmetric: a hand ascends from 50, crosses the split when
        // it must (at 64, past r0's ceiling of 63), then bounces back.
        // The bounce stays with the upper region.
        const lp = [null, null];
        expect(runSequence([50, 55, 58, 60, 62, 63, 64, 63], [60], [R3], lp))
            .toEqual([0, 0, 0, 0, 0, 0, 1, 1]);
    });
});

describe("routeNote — hard split (ranges = 0)", () => {
    it("routes a pitch above the split to the upper region", () => {
        const lp = [null, null];
        const [lo, hi] = bounds([60], [R0]);
        expect(routeNote(65, lo, hi, lp, -1)).toBe(1);
        expect(lp[1]).toBe(65);
    });

    it("routes a pitch below the split to the lower region", () => {
        const lp = [null, null];
        const [lo, hi] = bounds([60], [R0]);
        expect(routeNote(55, lo, hi, lp, -1)).toBe(0);
        expect(lp[0]).toBe(55);
    });

    it("routes the split note itself to the upper region", () => {
        const [lo, hi] = bounds([60], [R0]);
        expect(routeNote(60, lo, hi, [null, null], -1)).toBe(1);
    });

    it("does not let a last-pitch leak across the hard line", () => {
        const lp = [null, 60];
        const [lo, hi] = bounds([60], [R0]);
        // R0: upper's claim zone is [60, ∞), so 58 cannot be upper
        // no matter what lp_upper is.
        expect(routeNote(58, lo, hi, lp, -1)).toBe(0);
    });
});

describe("routeNote — two splits", () => {
    const splits = [48, 72];
    const ranges = [R3, R3];

    it("routes a low pitch to region 0", () => {
        const [lo, hi] = bounds(splits, ranges);
        expect(routeNote(30, lo, hi, [null, null, null], -1)).toBe(0);
    });

    it("routes a middle pitch to region 1", () => {
        const [lo, hi] = bounds(splits, ranges);
        expect(routeNote(60, lo, hi, [null, null, null], -1)).toBe(1);
    });

    it("routes a high pitch to region 2", () => {
        const [lo, hi] = bounds(splits, ranges);
        expect(routeNote(90, lo, hi, [null, null, null], -1)).toBe(2);
    });

    it("routes each split point itself to the region above it", () => {
        const [lo, hi] = bounds(splits, ranges);
        expect(routeNote(48, lo, hi, [null, null, null], -1)).toBe(1);
        expect(routeNote(72, lo, hi, [null, null, null], -1)).toBe(2);
    });

    it("three-handed pattern stays in three distinct regions", () => {
        const lp = [null, null, null];
        expect(runSequence([36, 60, 76, 36, 62, 75, 36, 64, 74], splits, ranges, lp))
            .toEqual([0, 1, 2, 0, 1, 2, 0, 1, 2]);
    });

    it("descending past the topmost split moves into the middle region", () => {
        const lp = [null, null, null];
        expect(runSequence([72, 71, 70, 69, 68, 67, 66], splits, ranges, lp))
            .toEqual([2, 2, 2, 2, 1, 1, 1]);
    });

    it("ascending past a split's floating range moves into the next region", () => {
        const lp = [null, null, null];
        expect(runSequence([36, 48, 50, 51, 52, 53], splits, ranges, lp))
            .toEqual([0, 0, 0, 0, 1, 1]);
    });

    it("stale last-pitch in another region does not hijack the active hand", () => {
        // The user-reported regression. Same melody as the next test,
        // but the user had played 57 in isolation earlier — fresh-state
        // tie-break put that lone 57 into r2 (highest index wins on
        // null-vs-null), leaving lp_r2 = 57. When the descending
        // melody later returns to 57, naive closest-last-pitch would
        // see lp_r2 = 57 (dist 0) vs lp_r1 = 59 (dist 2) and pull
        // the note across to r2. The follow-the-hand buffer keeps it
        // in r1 with the active hand.
        const localSplits = [47, 60];
        const localRanges = [R0, R3];
        const lp = [null, null, 57];
        let prev = 2;
        const [lo, hi] = bounds(localSplits, localRanges);
        const results = [55, 57, 59, 60, 59, 57].map(p => {
            prev = routeNote(p, lo, hi, lp, prev);
            return prev;
        });
        expect(results).toEqual([1, 1, 1, 1, 1, 1]);
    });

    it("middle-region melody stays in middle when descending through the split point", () => {
        // Splits at 47 (hard 0/0) and 60 (smart 3/3). The middle
        // region's home covers [47, 60). The user walks
        // 55→57→59→60→59→57 — ascending across split 2 into its reach
        // zone, then descending back. All six notes are clearly a
        // single middle-region hand and must all go to region 1.
        const localSplits = [47, 60];
        const localRanges = [R0, R3];
        const lp = [null, null, null];
        expect(runSequence([55, 57, 59, 60, 59, 57], localSplits, localRanges, lp))
            .toEqual([1, 1, 1, 1, 1, 1]);
    });

    it("mixes a hard bass split with a smart organ split", () => {
        const mixed = [R0, R3];
        const lp = [null, 49, null];
        const [lo, hi] = bounds(splits, mixed);
        // 47 falls in bass's claim (-∞, 48]; with hard split at 48,
        // middle cannot pull it up.
        expect(routeNote(47, lo, hi, lp, -1)).toBe(0);
    });
});

// Minimal cache stand-in for the routeNoteOn / routeNoteOff helpers.
// Mirrors the shape rebuildCache builds in the Scripter wrapper.
function makeCache(splits, ranges, channels, transposes) {
    const [lowerBounds, upperBounds] = bounds(splits, ranges);
    const failsafeChannels = [];
    for (const ch of channels) {
        if (!failsafeChannels.includes(ch)) failsafeChannels.push(ch);
    }
    return {
        lowerBounds,
        upperBounds,
        regionChannels: channels.slice(),
        regionTransposes: transposes.slice(),
        failsafeChannels
    };
}

// Simulates a Scripter NoteOn/NoteOff: a mutable bag of pitch + channel.
function makeEvent(pitch, channel = 0) {
    return { pitch, channel };
}

describe("routeNoteOn / routeNoteOff — note pairing under transposition", () => {
    it("NoteOff for a transposed note carries the same transposed pitch as its NoteOn", () => {
        // The reported bug: lower region is transposed +1 octave. A
        // NoteOn at controller pitch 50 goes out as pitch 62. The
        // matching NoteOff must also go out as pitch 62 — otherwise
        // the synth, which only saw pitch 62 turn on, never gets a
        // NoteOff for it and the note hangs.
        const cache = makeCache([60], [R3], [2, 1], [1, 0]);
        const lastPitches = [null, null];
        const noteToChannel = new Array(128).fill(null);
        const noteToPitch = new Array(128).fill(null);

        const on = makeEvent(50);
        routeNoteOn(on, cache, lastPitches, -1, noteToChannel, noteToPitch);
        expect(on.pitch).toBe(62);
        expect(on.channel).toBe(2);

        const off = makeEvent(50);
        const sent = routeNoteOff(off, noteToChannel, noteToPitch);
        expect(sent).toBe(true);
        expect(off.pitch).toBe(62);
        expect(off.channel).toBe(2);
    });

    it("transposed lower region overlapping the upper region: each NoteOff pairs with its own NoteOn", () => {
        // Lower transposed +1 oct, upper at unity. Controller plays 50
        // (→ out as 62 on lower's channel) and 64 (→ out as 64 on
        // upper's channel). Both held simultaneously. Releasing each
        // must reach the correct channel with the same output pitch
        // the synth heard on NoteOn.
        const cache = makeCache([60], [R3], [2, 1], [1, 0]);
        const lastPitches = [null, null];
        const noteToChannel = new Array(128).fill(null);
        const noteToPitch = new Array(128).fill(null);

        const on1 = makeEvent(50);
        routeNoteOn(on1, cache, lastPitches, -1, noteToChannel, noteToPitch);
        const on2 = makeEvent(64);
        routeNoteOn(on2, cache, lastPitches, 0, noteToChannel, noteToPitch);

        expect(on1.pitch).toBe(62);
        expect(on1.channel).toBe(2);
        expect(on2.pitch).toBe(64);
        expect(on2.channel).toBe(1);

        const off1 = makeEvent(50);
        routeNoteOff(off1, noteToChannel, noteToPitch);
        expect(off1.pitch).toBe(62);
        expect(off1.channel).toBe(2);

        const off2 = makeEvent(64);
        routeNoteOff(off2, noteToChannel, noteToPitch);
        expect(off2.pitch).toBe(64);
        expect(off2.channel).toBe(1);
    });

    it("NoteOff with no recorded NoteOn returns false (caller fans out as failsafe)", () => {
        const noteToChannel = new Array(128).fill(null);
        const noteToPitch = new Array(128).fill(null);
        const off = makeEvent(64);
        expect(routeNoteOff(off, noteToChannel, noteToPitch)).toBe(false);
    });

    it("releasing a held note clears its slot so a re-press routes independently", () => {
        const cache = makeCache([60], [R3], [2, 1], [1, 0]);
        const lastPitches = [null, null];
        const noteToChannel = new Array(128).fill(null);
        const noteToPitch = new Array(128).fill(null);

        routeNoteOn(makeEvent(50), cache, lastPitches, -1, noteToChannel, noteToPitch);
        routeNoteOff(makeEvent(50), noteToChannel, noteToPitch);
        expect(noteToChannel[50]).toBeNull();
        expect(noteToPitch[50]).toBeNull();
        // After release a stale NoteOff should not be routed.
        expect(routeNoteOff(makeEvent(50), noteToChannel, noteToPitch)).toBe(false);
    });
});

describe("transposeByOctaves", () => {
    it("transposes up by octaves", () => {
        expect(transposeByOctaves(60, 1)).toBe(72);
        expect(transposeByOctaves(60, 2)).toBe(84);
    });

    it("transposes down by octaves", () => {
        expect(transposeByOctaves(60, -1)).toBe(48);
        expect(transposeByOctaves(60, -2)).toBe(36);
    });

    it("clamps to MIDI range [0, 127]", () => {
        expect(transposeByOctaves(120, 2)).toBe(127);
        expect(transposeByOctaves(10, -2)).toBe(0);
    });

    it("handles zero transposition", () => {
        expect(transposeByOctaves(60, 0)).toBe(60);
    });
});
