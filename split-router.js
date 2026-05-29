/**
 * N-zone keyboard split router.
 *
 * Takes pre-computed claim zones for each zone as two parallel
 * arrays of length N+1:
 *
 *   lowerBounds[k] = lowest pitch zone k can claim
 *   upperBounds[k] = highest pitch zone k can claim
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
 * When a pitch falls inside a zone's claim zone, the zone is a
 * candidate. The choice among multiple candidates:
 *
 *   1. If there is a previous-note zone (prevZone ≥ 0) and it is
 *      among the candidates, it keeps the note UNLESS another
 *      candidate's last-played pitch is more than STAY_BUFFER
 *      semitones closer than prev's. This follow-the-hand bias keeps
 *      a melody continuing through the active zone from being
 *      yanked across by a stale or coincidental match in another
 *      zone, while still letting a clearly-closer other hand
 *      reclaim the note.
 *   2. Otherwise the candidate whose last-played pitch is closest in
 *      semitones wins; zones with no last pitch are treated as
 *      infinitely far; ties go to the higher zone index.
 *
 * Caller responsibilities:
 *   - lowerBounds and upperBounds must be aligned (same length, same
 *     zone order). The Scripter wrapper guarantees this.
 *   - lastPitches is mutated in place: lastPitches[chosen] = pitch.
 *   - prevZone tracks the zone returned by the most recent call,
 *     or -1 if there has been none. The caller stores the return
 *     value and passes it back next time.
 *
 * Returns the chosen zone index.
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

export function routeNote(pitch, lowerBounds, upperBounds, lastPitches, prevZone) {
    var numZones = lowerBounds.length;

    var candidateCount = 0;
    var soleCandidate = -1;
    var prevIsCandidate = false;
    var bestZone = -1;
    var bestDist = Infinity;

    for (var k = 0; k < numZones; k++) {
        if (pitch < lowerBounds[k] || pitch > upperBounds[k]) continue;

        candidateCount++;
        soleCandidate = k;
        if (k === prevZone) prevIsCandidate = true;

        var lp = lastPitches[k];
        var dist = (lp !== null && lp !== undefined)
            ? Math.abs(pitch - lp)
            : Infinity;
        // Ascending iteration; `<=` sends ties to the higher index.
        if (bestZone === -1 || dist <= bestDist) {
            bestZone = k;
            bestDist = dist;
        }
    }

    var chosen;
    if (candidateCount === 1) {
        chosen = soleCandidate;
    } else if (prevIsCandidate) {
        var prevPitch = lastPitches[prevZone];
        var prevDist = (prevPitch !== null && prevPitch !== undefined)
            ? Math.abs(pitch - prevPitch)
            : Infinity;
        chosen = bestDist + STAY_BUFFER < prevDist ? bestZone : prevZone;
    } else {
        chosen = bestZone;
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

/**
 * Route a NoteOn: pick a zone, set the event's channel and
 * (possibly transposed) pitch, and remember both per controller
 * pitch so the matching NoteOff can mirror them. Returns the chosen
 * zone index — the caller stores this as the new prevZone.
 *
 * Tracking both channel AND output pitch is what stops transposed
 * notes from hanging: a NoteOn sent at the transposed pitch must
 * be paired with a NoteOff at the same transposed pitch, even
 * though the controller's NoteOff carries the original pitch.
 *
 * Mutates event.pitch, event.channel, noteToChannel, noteToPitch.
 */
export function routeNoteOn(event, cache, lastPitches, prevZone, noteToChannel, noteToPitch) {
    var originalPitch = event.pitch;
    var idx = routeNote(originalPitch, cache.lowerBounds, cache.upperBounds, lastPitches, prevZone);
    var ch = cache.zoneChannels[idx];
    var outPitch = transposeByOctaves(originalPitch, cache.zoneTransposes[idx]);
    event.pitch = outPitch;
    event.channel = ch;
    noteToChannel[originalPitch] = ch;
    noteToPitch[originalPitch] = outPitch;
    return idx;
}

/**
 * Route a NoteOff: if the original pitch has a remembered NoteOn,
 * rewrite the event's channel/pitch to match what the synth heard
 * and clear the slot. Returns true if the caller should send the
 * event as-is; false means there is no recorded pairing and the
 * caller should fan out across cache.failsafeChannels.
 */
export function routeNoteOff(event, noteToChannel, noteToPitch) {
    var originalPitch = event.pitch;
    var ch = noteToChannel[originalPitch];
    if (ch === null || ch === undefined) return false;
    event.channel = ch;
    event.pitch = noteToPitch[originalPitch];
    noteToChannel[originalPitch] = null;
    noteToPitch[originalPitch] = null;
    return true;
}
