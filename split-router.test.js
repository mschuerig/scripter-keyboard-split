import { describe, it, expect } from "bun:test";
import { routeNote, transposeByOctaves } from "./split-router.js";

describe("routeNote with dual-region tracking", () => {
    it("routes simple upper region notes", () => {
        const result = routeNote({
            pitch: 65,
            lastPitchUpper: null,
            lastPitchLower: null,
            baseSplit: 60,
            floatingRangeAbove: 3,
            floatingRangeBelow: 3
        });
        expect(result.channel).toBe(1);
        expect(result.newLastPitchUpper).toBe(65);
    });

    it("routes simple lower region notes", () => {
        const result = routeNote({
            pitch: 55,
            lastPitchUpper: null,
            lastPitchLower: null,
            baseSplit: 60,
            floatingRangeAbove: 3,
            floatingRangeBelow: 3
        });
        expect(result.channel).toBe(2);
        expect(result.newLastPitchLower).toBe(55);
    });

    it("handles two-handed organ pattern: 64, 52, 62, 52, 60, 52, 59", () => {
        const sequence = [64, 52, 62, 52, 60, 52, 59];
        const baseSplit = 60;
        const floatingAbove = 3;
        const floatingBelow = 3;

        let state = {
            lastPitchUpper: null,
            lastPitchLower: null,
            baseSplit,
            floatingRangeAbove: floatingAbove,
            floatingRangeBelow: floatingBelow
        };

        const results = [];

        for (const pitch of sequence) {
            state.pitch = pitch;
            const result = routeNote(state);
            results.push(result.channel);
            state.lastPitchUpper = result.newLastPitchUpper;
            state.lastPitchLower = result.newLastPitchLower;
        }

        // Expected: 64=upper, 52=lower, 62=upper, 52=lower, 60=upper, 52=lower, 59=upper
        expect(results).toEqual([1, 2, 1, 2, 1, 2, 1]);
    });

    it("keeps melody together within floating range", () => {
        // Play 70, 69, 68 descending in upper region
        let state = {
            lastPitchUpper: null,
            lastPitchLower: null,
            baseSplit: 60,
            floatingRangeAbove: 3,
            floatingRangeBelow: 3,
            pitch: 70
        };

        // 70 outside [60,63], but 70 >= 60 → upper
        let r1 = routeNote(state);
        expect(r1.channel).toBe(1);
        state.lastPitchUpper = r1.newLastPitchUpper;

        // 69: |69-70| = 1 <= floatingBelow(3), stay with upper
        state.pitch = 69;
        let r2 = routeNote(state);
        expect(r2.channel).toBe(1);
        state.lastPitchUpper = r2.newLastPitchUpper;

        // 68: |68-69| = 1 <= floatingBelow(3), stay with upper
        state.pitch = 68;
        let r3 = routeNote(state);
        expect(r3.channel).toBe(1);
    });

    it("allows crossover when both hands play in overlap zone", () => {
        // Upper region plays down to 60 (at base split)
        let state = {
            lastPitchUpper: 62,
            lastPitchLower: 50,
            baseSplit: 60,
            floatingRangeAbove: 3,
            floatingRangeBelow: 3,
            pitch: 60
        };

        let result = routeNote(state);
        // 60 is in both ranges, closer to upper (2 semitones) than lower (10)
        expect(result.channel).toBe(1);
    });

    it("reassigns to lower if lower hand moves significantly closer", () => {
        let state = {
            lastPitchUpper: 62,
            lastPitchLower: 58,
            baseSplit: 60,
            floatingRangeAbove: 3,
            floatingRangeBelow: 3,
            pitch: 57
        };

        let result = routeNote(state);
        // 57 is in lower range [57,60], |57-58| = 1 vs |57-62| = 5
        expect(result.channel).toBe(2);
        expect(result.newLastPitchLower).toBe(57);
    });
});

describe("routeNote in Fixed mode", () => {
    it("routes notes at or above base split to upper", () => {
        const result = routeNote({
            splitMode: 0,
            pitch: 65,
            lastPitchUpper: null,
            lastPitchLower: null,
            baseSplit: 60,
            floatingRangeAbove: 3,
            floatingRangeBelow: 3
        });
        expect(result.channel).toBe(1);
        expect(result.newLastPitchUpper).toBe(65);
    });

    it("routes notes below base split to lower", () => {
        const result = routeNote({
            splitMode: 0,
            pitch: 55,
            lastPitchUpper: null,
            lastPitchLower: null,
            baseSplit: 60,
            floatingRangeAbove: 3,
            floatingRangeBelow: 3
        });
        expect(result.channel).toBe(2);
        expect(result.newLastPitchLower).toBe(55);
    });

    it("routes the base split note itself to upper (>= semantics)", () => {
        const result = routeNote({
            splitMode: 0,
            pitch: 60,
            lastPitchUpper: null,
            lastPitchLower: null,
            baseSplit: 60,
            floatingRangeAbove: 3,
            floatingRangeBelow: 3
        });
        expect(result.channel).toBe(1);
        expect(result.newLastPitchUpper).toBe(60);
    });

    it("ignores floating state and ranges", () => {
        // A note that Floating mode would route to upper (close to
        // lastPitchUpper=62) must instead go to lower under Fixed
        // because 58 < baseSplit=60.
        const result = routeNote({
            splitMode: 0,
            pitch: 58,
            lastPitchUpper: 62,
            lastPitchLower: null,
            baseSplit: 60,
            floatingRangeAbove: 12,
            floatingRangeBelow: 12
        });
        expect(result.channel).toBe(2);
        expect(result.newLastPitchLower).toBe(58);
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
