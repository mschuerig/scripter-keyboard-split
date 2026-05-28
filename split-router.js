/**
 * Routing with split-mode selection (Fixed or Floating).
 *
 * Fixed mode: pitch >= baseSplit goes to the upper region, otherwise lower.
 *
 * Floating mode: tracks the most recent note in each region separately.
 * A new note is assigned to the region whose recent note is closest,
 * within that region's floating range. This handles two-handed playing
 * (alternating or crossing hands) without the split thrashing between
 * independent lines.
 *
 * Returns the routed channel (1 = upper, 2 = lower) plus the updated
 * lastPitchUpper / lastPitchLower values. Callers carry that state
 * into the next call.
 *
 * Body uses ES5-friendly constructs (var, function declarations) so it
 * can be inlined into the MainStage Scripter file by build.js.
 */
export function routeNote(input) {
    var pitch = input.pitch;
    var lastPitchUpper = input.lastPitchUpper;
    var lastPitchLower = input.lastPitchLower;
    var baseSplit = input.baseSplit;
    var floatingRangeAbove = input.floatingRangeAbove;
    var floatingRangeBelow = input.floatingRangeBelow;
    var splitMode = input.splitMode;
    if (splitMode === undefined || splitMode === null) {
        splitMode = 1;
    }

    var channel;
    var newLastPitchUpper = lastPitchUpper;
    var newLastPitchLower = lastPitchLower;

    if (splitMode === 0) {
        if (pitch >= baseSplit) {
            channel = 1;
            newLastPitchUpper = pitch;
        } else {
            channel = 2;
            newLastPitchLower = pitch;
        }
        return {
            channel: channel,
            newLastPitchUpper: newLastPitchUpper,
            newLastPitchLower: newLastPitchLower
        };
    }

    var upperLow = baseSplit;
    var upperHigh = baseSplit + floatingRangeAbove;
    var lowerLow = baseSplit - floatingRangeBelow;
    var lowerHigh = baseSplit;

    var canStayWithUpper = lastPitchUpper !== null &&
        Math.abs(pitch - lastPitchUpper) <= floatingRangeBelow;
    var canStayWithLower = lastPitchLower !== null &&
        Math.abs(pitch - lastPitchLower) <= floatingRangeAbove;

    var inUpperRange = pitch >= upperLow && pitch <= upperHigh;
    var inLowerRange = pitch >= lowerLow && pitch <= lowerHigh;

    if ((inUpperRange || canStayWithUpper) && (inLowerRange || canStayWithLower)) {
        var distToUpper = lastPitchUpper !== null ? Math.abs(pitch - lastPitchUpper) : Infinity;
        var distToLower = lastPitchLower !== null ? Math.abs(pitch - lastPitchLower) : Infinity;
        if (distToUpper <= distToLower) {
            channel = 1;
            newLastPitchUpper = pitch;
        } else {
            channel = 2;
            newLastPitchLower = pitch;
        }
    } else if (inUpperRange || canStayWithUpper) {
        channel = 1;
        newLastPitchUpper = pitch;
    } else if (inLowerRange || canStayWithLower) {
        channel = 2;
        newLastPitchLower = pitch;
    } else {
        if (pitch >= baseSplit) {
            channel = 1;
            newLastPitchUpper = pitch;
        } else {
            channel = 2;
            newLastPitchLower = pitch;
        }
    }

    return {
        channel: channel,
        newLastPitchUpper: newLastPitchUpper,
        newLastPitchLower: newLastPitchLower
    };
}

/**
 * Apply octave transposition to a MIDI note, clamped to [0, 127].
 */
export function transposeByOctaves(pitch, octaves) {
    return Math.max(0, Math.min(127, pitch + octaves * 12));
}
