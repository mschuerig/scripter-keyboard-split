import { describe, it, expect } from "bun:test";
import { routeNote, transposeByOctaves } from "./split-router.js";

const R3 = { above: 3, below: 3 };
const R0 = { above: 0, below: 0 };

function runSequence(pitches, splits, ranges, lp) {
    let prev = -1;
    return pitches.map(p => {
        prev = routeNote(p, splits, ranges, lp, prev);
        return prev;
    });
}

describe("routeNote — single split", () => {
    it("routes a pitch above the floating zone to the upper region", () => {
        const lp = [null, null];
        expect(routeNote(65, [60], [R3], lp, -1)).toBe(1);
        expect(lp).toEqual([null, 65]);
    });

    it("routes a pitch below the floating zone to the lower region", () => {
        const lp = [null, null];
        expect(routeNote(55, [60], [R3], lp, -1)).toBe(0);
        expect(lp).toEqual([55, null]);
    });

    it("handles the two-handed organ pattern 64, 52, 62, 52, 60, 52, 59", () => {
        const lp = [null, null];
        // Two distinct hands. Right hand opens at 64 (only r1 candidate).
        // Each left-hand 52 is forced to r0 (out of r1's claim). When
        // the right hand returns to a near-split pitch (62, 60, 59),
        // the prev-region rule does NOT fire (the step from 52 is
        // larger than the floating range), so closest-last-pitch wins
        // and the right hand at lp_r1=64 reclaims the note.
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
        // No prev set; closest-last-pitch picks r1 (dist 2 < 10).
        expect(routeNote(60, [60], [R3], lp, -1)).toBe(1);
    });

    it("reassigns to lower if lower hand moves significantly closer", () => {
        const lp = [58, 62];
        // No prev; r0 dist=1, r1 dist=5 → r0.
        expect(routeNote(57, [60], [R3], lp, -1)).toBe(0);
        expect(lp[0]).toBe(57);
    });

    it("ties go to the higher region index (upper wins on tie)", () => {
        const lp = [58, 62];
        // 60 ∈ both claim zones; dists both 2; no prev → higher index.
        expect(routeNote(60, [60], [R3], lp, -1)).toBe(1);
    });

    it("does not extend a region past its floating range", () => {
        // Lower played 48; upper's claim is [57, ∞). A pitch of 56 is
        // outside upper's zone — upper cannot claim it.
        const lp = [48, null];
        expect(routeNote(56, [60], [R3], lp, -1)).toBe(0);
    });

    it("follows the active hand back across the split (descending then bouncing)", () => {
        // The reported bug. A single hand walked 62→56; when it
        // bounces back to 57, it stays with the lower region (the
        // hand that just played 56), not the upper region whose stale
        // lp=57 happens to match exactly.
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
        expect(routeNote(65, [60], [R0], lp, -1)).toBe(1);
        expect(lp[1]).toBe(65);
    });

    it("routes a pitch below the split to the lower region", () => {
        const lp = [null, null];
        expect(routeNote(55, [60], [R0], lp, -1)).toBe(0);
        expect(lp[0]).toBe(55);
    });

    it("routes the split note itself to the upper region", () => {
        expect(routeNote(60, [60], [R0], [null, null], -1)).toBe(1);
    });

    it("does not let a last-pitch leak across the hard line", () => {
        const lp = [null, 60];
        // R0: upper's claim zone is [60, ∞), so 58 cannot be upper
        // no matter what lp_upper is.
        expect(routeNote(58, [60], [R0], lp, -1)).toBe(0);
    });
});

describe("routeNote — two splits", () => {
    const splits = [48, 72];
    const ranges = [R3, R3];

    it("routes a low pitch to region 0", () => {
        expect(routeNote(30, splits, ranges, [null, null, null], -1)).toBe(0);
    });

    it("routes a middle pitch to region 1", () => {
        expect(routeNote(60, splits, ranges, [null, null, null], -1)).toBe(1);
    });

    it("routes a high pitch to region 2", () => {
        expect(routeNote(90, splits, ranges, [null, null, null], -1)).toBe(2);
    });

    it("routes each split point itself to the region above it", () => {
        expect(routeNote(48, splits, ranges, [null, null, null], -1)).toBe(1);
        expect(routeNote(72, splits, ranges, [null, null, null], -1)).toBe(2);
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
        // tie-break puts that lone 57 into r2 (highest index wins on
        // null-vs-null), leaving lp_r2 = 57. When the descending
        // melody later returns to 57, the closest-last-pitch tiebreak
        // sees lp_r2 = 57 (dist 0) vs lp_r1 = 59 (dist 2) and pulls
        // the note across to r2. The right answer is to stay in r1
        // with the active hand.
        const splits = [47, 60];
        const ranges = [R0, R3];
        const lp = [null, null, 57];
        let prev = 2;
        const results = [55, 57, 59, 60, 59, 57].map(p => {
            prev = routeNote(p, splits, ranges, lp, prev);
            return prev;
        });
        expect(results).toEqual([1, 1, 1, 1, 1, 1]);
    });

    it("middle-region melody stays in middle when descending through the split point", () => {
        // User-reported case. Splits at 47 (hard 0/0) and 60 (smart 3/3).
        // The middle region's home covers [47, 60). The user walks
        // 55→57→59→60→59→57 — ascending across split 2 into its reach
        // zone, then descending back. All six notes are clearly a
        // single middle-region hand and must all go to region 1.
        const splits = [47, 60];
        const ranges = [R0, R3];
        const lp = [null, null, null];
        expect(runSequence([55, 57, 59, 60, 59, 57], splits, ranges, lp))
            .toEqual([1, 1, 1, 1, 1, 1]);
    });

    it("mixes a hard bass split with a smart organ split", () => {
        const mixed = [R0, R3];
        const lp = [null, 49, null];
        // 47 falls in bass's claim (-∞, 48]; with hard split at 48,
        // middle cannot pull it up.
        expect(routeNote(47, splits, mixed, lp, -1)).toBe(0);
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
