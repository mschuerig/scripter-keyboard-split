/**
 * N-region keyboard split router.
 *
 * The keyboard is divided by N split points into N+1 contiguous regions,
 * numbered from 0 (lowest pitches) to N (highest). Each split point has
 * a Floating Range Above and Below (in semitones) that defines how far
 * the two adjacent regions can extend past the split. Region k's claim
 * zone is:
 *   [splitPoints[k-1] - floatingRanges[k-1].below,
 *    splitPoints[k]   + floatingRanges[k].above]
 * with -Infinity below region 0 and +Infinity above region N.
 *
 * A region can claim a pitch only if the pitch falls inside its claim
 * zone — the floating range is a hard bound on how far the region
 * extends, not a stay-with reach from the last pitch.
 *
 * When multiple regions claim, the choice goes:
 *   1. If there is a previous-note region and it is among the
 *      candidates, it keeps the note UNLESS another candidate's
 *      last-played pitch is more than STAY_BUFFER semitones closer
 *      to the new pitch than prev's. This "follow-the-hand" rule
 *      lets a melody continuing through the prev region's claim zone
 *      stay there, while still allowing a clearly-closer other hand
 *      to win (e.g. two-handed organ pattern, where the other
 *      region's recent note is much closer than the freshly-played
 *      one in prev). The buffer prevents a stale or coincidental
 *      last-pitch in another region from narrowly beating prev.
 *   2. Otherwise the candidate whose last-played pitch is closest in
 *      semitones wins; regions with no last pitch are treated as
 *      infinitely far; ties go to the higher region index.
 *
 * Setting both ranges of a split to 0 collapses it into a hard line —
 * the two adjacent claim zones meet only at the split point itself.
 *
 * Caller responsibilities:
 *   - splitPoints must be sorted ascending and aligned with
 *     floatingRanges (the Scripter wrapper does this in rebuildCache).
 *   - lastPitches is mutated in place: lastPitches[chosen] is set to
 *     the new pitch before this function returns.
 *   - prevRegion tracks the region returned by the most recent call
 *     (or -1 if there has been none). The caller stores the return
 *     value of this call and passes it as prevRegion next time.
 *
 * Returns the chosen region index. The caller maps it to a MIDI
 * channel and transposition.
 *
 * Body uses ES5-friendly constructs (var, function declarations) so it
 * can be inlined into the MainStage Scripter file by build.js.
 */

var STAY_BUFFER = 2;

export function routeNote(pitch, splitPoints, floatingRanges, lastPitches, prevRegion) {
    var N = splitPoints.length;
    var numRegions = N + 1;

    var candidateCount = 0;
    var soleCandidate = -1;
    var prevIsCandidate = false;
    var bestRegion = -1;
    var bestDist = Infinity;

    for (var k = 0; k < numRegions; k++) {
        var lower = k > 0
            ? splitPoints[k - 1] - floatingRanges[k - 1].below
            : -Infinity;
        var upper = k < N
            ? splitPoints[k] + floatingRanges[k].above
            : Infinity;
        if (pitch < lower || pitch > upper) continue;

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
