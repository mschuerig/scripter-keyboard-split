/**
 * N-region keyboard split router.
 *
 * Takes pre-computed claim zones for each region as two parallel
 * arrays of length N+1:
 *
 *   lowerBounds[k] = lowest pitch region k can claim
 *   upperBounds[k] = highest pitch region k can claim
 *
 * with `lowerBounds[0] = -Infinity` and `upperBounds[N] = +Infinity`
 * for the unbounded outer edges. The Scripter wrapper computes these
 * in rebuildCache from the sorted splitPoints and floatingRanges:
 *
 *   upperBounds[k]     = splitPoints[k] + floatingRanges[k].above   (k < N)
 *   lowerBounds[k + 1] = splitPoints[k] - floatingRanges[k].below   (k < N)
 *
 * Setting both ranges of a split to 0 collapses it into a hard line —
 * the two adjacent claim zones meet only at the split point.
 *
 * When a pitch falls inside a region's claim zone, the region is a
 * candidate. The choice among multiple candidates:
 *
 *   1. If there is a previous-note region (prevRegion ≥ 0) and it is
 *      among the candidates, it keeps the note UNLESS another
 *      candidate's last-played pitch is more than STAY_BUFFER
 *      semitones closer than prev's. This follow-the-hand bias keeps
 *      a melody continuing through the active region from being
 *      yanked across by a stale or coincidental match in another
 *      region, while still letting a clearly-closer other hand
 *      reclaim the note.
 *   2. Otherwise the candidate whose last-played pitch is closest in
 *      semitones wins; regions with no last pitch are treated as
 *      infinitely far; ties go to the higher region index.
 *
 * Caller responsibilities:
 *   - lowerBounds and upperBounds must be aligned (same length, same
 *     region order). The Scripter wrapper guarantees this.
 *   - lastPitches is mutated in place: lastPitches[chosen] = pitch.
 *   - prevRegion tracks the region returned by the most recent call,
 *     or -1 if there has been none. The caller stores the return
 *     value and passes it back next time.
 *
 * Returns the chosen region index.
 *
 * Hot-path discipline: this function makes no heap allocations — it
 * uses only primitive locals and reads/writes existing arrays in
 * place. All sorting and bound arithmetic lives in rebuildCache,
 * which runs only when the user touches a knob.
 *
 * Body uses ES5-friendly constructs (var, function declarations) so
 * it can be inlined into the MainStage Scripter file by build.js.
 */

var STAY_BUFFER = 2;

export function routeNote(pitch, lowerBounds, upperBounds, lastPitches, prevRegion) {
    var numRegions = lowerBounds.length;

    var candidateCount = 0;
    var soleCandidate = -1;
    var prevIsCandidate = false;
    var bestRegion = -1;
    var bestDist = Infinity;

    for (var k = 0; k < numRegions; k++) {
        if (pitch < lowerBounds[k] || pitch > upperBounds[k]) continue;

        candidateCount++;
        soleCandidate = k;
        if (k === prevRegion) prevIsCandidate = true;

        var lp = lastPitches[k];
        var dist = (lp !== null && lp !== undefined)
            ? Math.abs(pitch - lp)
            : Infinity;
        // Ascending iteration; `<=` sends ties to the higher index.
        if (bestRegion === -1 || dist <= bestDist) {
            bestRegion = k;
            bestDist = dist;
        }
    }

    var chosen;
    if (candidateCount === 1) {
        chosen = soleCandidate;
    } else if (prevIsCandidate) {
        var prevPitch = lastPitches[prevRegion];
        var prevDist = (prevPitch !== null && prevPitch !== undefined)
            ? Math.abs(pitch - prevPitch)
            : Infinity;
        chosen = bestDist + STAY_BUFFER < prevDist ? bestRegion : prevRegion;
    } else {
        chosen = bestRegion;
    }

    lastPitches[chosen] = pitch;
    return chosen;
}

/**
 * Apply octave transposition to a MIDI note, clamped to [0, 127].
 */
export function transposeByOctaves(pitch, octaves) {
    return Math.max(0, Math.min(127, pitch + octaves * 12));
}
