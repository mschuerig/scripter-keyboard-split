/**
 * scripter-keyboard-split — MainStage / Logic Pro Scripter plugin
 *
 * Splits the keyboard between up to MAX_SPLITS + 1 MIDI channels.
 * Each split has Floating Range Above / Below knobs that govern how
 * far the adjacent regions extend past the split. Set both ranges of
 * a split to 0 for a hard, fixed boundary; nonzero ranges let each
 * region claim a band of pitches past the split and hold onto notes
 * that briefly cross over.
 *
 * Region 1 is the lowest region of the keyboard; Region N+1 the
 * highest. After sorting, Split Point 1 is the lowest split. The
 * parameter list is interleaved low-to-high — Region 1, Split 1,
 * Region 2, Split 2, … — so adjusting Number of Splits reveals or
 * hides rows at the bottom of the list without shifting the rest.
 *
 * This file is GENERATED. The routing logic block between the
 * @inject:split-router markers comes from split-router.js. To edit the
 * routing algorithm, change split-router.js and run `bun run build`.
 */

var MAX_SPLITS = 3;
var MAX_REGIONS = MAX_SPLITS + 1;

var DEFAULT_NUM_SPLITS = 1;
var DEFAULT_SPLIT_POINT = 60;
var DEFAULT_RANGE_ABOVE = 3;
var DEFAULT_RANGE_BELOW = 3;
// Region channels default to: R1=2, R2=1 (preserves the original
// "Lower=2, Upper=1" Hammond-style mapping for the single-split case);
// R3=3, R4=4 give each additional region a distinct channel by default.
var DEFAULT_REGION_CHANNELS = [null, 2, 1, 3, 4];
var DEFAULT_REGION_TRANSPOSE = 0;

var PluginParameters = [];
// Parallel array of dispatch metadata. Index aligns with PluginParameters.
// Kept off the parameter objects themselves so Scripter sees only
// standard fields and doesn't waste time iterating custom keys.
var paramMeta = [];

function addParam(spec, meta) {
    PluginParameters.push(spec);
    paramMeta.push(meta);
}

// "Number of Splits" as a discrete menu avoids the UI lag that comes
// from a "lin" knob firing UpdatePluginParameters() on every step of a
// drag. The menu fires once per selection.
var NUM_SPLITS_LABELS = [];
for (var i = 1; i <= MAX_SPLITS; i++) {
    NUM_SPLITS_LABELS.push(
        i === 1
            ? "1 split (2 regions)"
            : i + " splits (" + (i + 1) + " regions)"
    );
}
addParam({
    name: "Number of Splits",
    type: "menu",
    valueStrings: NUM_SPLITS_LABELS,
    defaultValue: DEFAULT_NUM_SPLITS - 1
}, { kind: "numSplits" });

for (var slot = 1; slot <= MAX_REGIONS; slot++) {
    addParam({
        name: "Region " + slot + " Channel",
        type: "lin",
        minValue: 1,
        maxValue: 16,
        numberOfSteps: 15,
        defaultValue: DEFAULT_REGION_CHANNELS[slot]
    }, { kind: "channel", regionIndex: slot });
    addParam({
        name: "Region " + slot + " Transpose",
        type: "lin",
        minValue: -4,
        maxValue: 4,
        numberOfSteps: 8,
        defaultValue: DEFAULT_REGION_TRANSPOSE
    }, { kind: "transpose", regionIndex: slot });
    if (slot <= MAX_SPLITS) {
        addParam({
            name: "Split Point " + slot,
            type: "lin",
            minValue: 0,
            maxValue: 127,
            numberOfSteps: 127,
            defaultValue: DEFAULT_SPLIT_POINT
        }, { kind: "point", splitIndex: slot });
        addParam({
            name: "Floating Range Above " + slot,
            type: "lin",
            minValue: 0,
            maxValue: 12,
            numberOfSteps: 12,
            defaultValue: DEFAULT_RANGE_ABOVE
        }, { kind: "above", splitIndex: slot });
        addParam({
            name: "Floating Range Below " + slot,
            type: "lin",
            minValue: 0,
            maxValue: 12,
            numberOfSteps: 12,
            defaultValue: DEFAULT_RANGE_BELOW
        }, { kind: "below", splitIndex: slot });
    }
}

// Raw parameter values keyed by 1-based split / region index. Initialised
// from defaults so the cache is valid before any ParameterChanged fires.
var rawSplitPoints = [null];
var rawRangeAbove = [null];
var rawRangeBelow = [null];
for (var i = 1; i <= MAX_SPLITS; i++) {
    rawSplitPoints.push(DEFAULT_SPLIT_POINT);
    rawRangeAbove.push(DEFAULT_RANGE_ABOVE);
    rawRangeBelow.push(DEFAULT_RANGE_BELOW);
}
var rawRegionChannels = DEFAULT_REGION_CHANNELS.slice();
var rawRegionTransposes = [null];
for (var i = 1; i <= MAX_REGIONS; i++) {
    rawRegionTransposes.push(DEFAULT_REGION_TRANSPOSE);
}

// Cache derived from raw values. HandleMIDI reads only this object.
var cache = {
    numSplits: DEFAULT_NUM_SPLITS,
    splitPoints: [],
    floatingRanges: [],
    regionChannels: [],
    regionTransposes: [],
    failsafeChannels: []
};

var lastPitches = new Array(MAX_REGIONS);
for (var i = 0; i < MAX_REGIONS; i++) lastPitches[i] = null;
var prevRegion = -1;

var noteToChannel = new Array(128);
for (var i = 0; i < 128; i++) noteToChannel[i] = null;

// @inject:split-router
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

function routeNote(pitch, splitPoints, floatingRanges, lastPitches, prevRegion) {
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
function transposeByOctaves(pitch, octaves) {
    return Math.max(0, Math.min(127, pitch + octaves * 12));
}
// @end-inject

function rebuildCache() {
    var N = cache.numSplits;
    var pairs = [];
    for (var i = 1; i <= N; i++) {
        pairs.push({
            point: rawSplitPoints[i],
            above: rawRangeAbove[i],
            below: rawRangeBelow[i]
        });
    }
    pairs.sort(function (a, b) { return a.point - b.point; });

    var pts = [];
    var rngs = [];
    for (var i = 0; i < N; i++) {
        pts.push(pairs[i].point);
        rngs.push({ above: pairs[i].above, below: pairs[i].below });
    }
    cache.splitPoints = pts;
    cache.floatingRanges = rngs;

    var chs = [];
    var trs = [];
    var seen = {};
    var failsafe = [];
    for (var i = 1; i <= N + 1; i++) {
        var ch = rawRegionChannels[i];
        chs.push(ch);
        trs.push(rawRegionTransposes[i]);
        if (!seen[ch]) {
            seen[ch] = true;
            failsafe.push(ch);
        }
    }
    cache.regionChannels = chs;
    cache.regionTransposes = trs;
    cache.failsafeChannels = failsafe;
}

function applyVisibility() {
    var N = cache.numSplits;
    for (var i = 0; i < paramMeta.length; i++) {
        var m = paramMeta[i];
        var hide = false;
        if (m.splitIndex !== undefined) hide = m.splitIndex > N;
        else if (m.regionIndex !== undefined) hide = m.regionIndex > N + 1;
        PluginParameters[i].hidden = hide;
    }
}

function ParameterChanged(param, value) {
    var m = paramMeta[param];
    if (!m) return;

    switch (m.kind) {
        case "numSplits":
            cache.numSplits = value + 1;
            rebuildCache();
            applyVisibility();
            UpdatePluginParameters();
            return;
        case "point":
            rawSplitPoints[m.splitIndex] = value;
            if (m.splitIndex <= cache.numSplits) rebuildCache();
            return;
        case "above":
            rawRangeAbove[m.splitIndex] = value;
            if (m.splitIndex <= cache.numSplits) rebuildCache();
            return;
        case "below":
            rawRangeBelow[m.splitIndex] = value;
            if (m.splitIndex <= cache.numSplits) rebuildCache();
            return;
        case "channel":
            rawRegionChannels[m.regionIndex] = value;
            if (m.regionIndex <= cache.numSplits + 1) rebuildCache();
            return;
        case "transpose":
            rawRegionTransposes[m.regionIndex] = value;
            if (m.regionIndex <= cache.numSplits + 1) rebuildCache();
            return;
    }
}

applyVisibility();
rebuildCache();

function HandleMIDI(event) {
    if (event instanceof NoteOn) {
        var originalPitch = event.pitch;
        var idx = routeNote(
            originalPitch,
            cache.splitPoints,
            cache.floatingRanges,
            lastPitches,
            prevRegion
        );
        prevRegion = idx;
        var targetChannel = cache.regionChannels[idx];
        event.pitch = transposeByOctaves(originalPitch, cache.regionTransposes[idx]);
        event.channel = targetChannel;
        noteToChannel[originalPitch] = targetChannel;
        event.send();
        return;
    }
    if (event instanceof NoteOff) {
        var recorded = noteToChannel[event.pitch];
        if (recorded !== null && recorded !== undefined) {
            event.channel = recorded;
            event.send();
            noteToChannel[event.pitch] = null;
        } else {
            // Failsafe: a NoteOff arrived with no recorded NoteOn channel
            // (e.g. script started mid-note). Fan out to every active
            // region channel so the note doesn't hang.
            var chs = cache.failsafeChannels;
            for (var i = 0; i < chs.length; i++) {
                event.channel = chs[i];
                event.send();
            }
        }
        return;
    }
    event.send();
}
