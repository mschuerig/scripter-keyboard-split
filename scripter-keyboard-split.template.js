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
 * Hot-path discipline: HandleMIDI reads only the pre-computed
 * cache. rebuildCache is the only function that mutates routing
 * state, and it does so in place — sorting via scratch arrays
 * allocated once at script load, and computing per-region claim
 * bounds (cache.lowerBounds / cache.upperBounds) so the router
 * doesn't have to do any arithmetic per event.
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
// All arrays are reused in place by rebuildCache.
var cache = {
    numSplits: DEFAULT_NUM_SPLITS,
    lowerBounds: [],
    upperBounds: [],
    regionChannels: [],
    regionTransposes: [],
    failsafeChannels: []
};

// Scratch arrays for the in-place sort in rebuildCache. Allocated
// once at script load and reused on every rebuild.
var sortPts = new Array(MAX_SPLITS);
var sortAbove = new Array(MAX_SPLITS);
var sortBelow = new Array(MAX_SPLITS);

var lastPitches = new Array(MAX_REGIONS);
for (var i = 0; i < MAX_REGIONS; i++) lastPitches[i] = null;
var prevRegion = -1;

var noteToChannel = new Array(128);
for (var i = 0; i < 128; i++) noteToChannel[i] = null;

// @inject:split-router
// (replaced by build.js with the contents of split-router.js)
// @end-inject

function rebuildCache() {
    var N = cache.numSplits;
    var numRegions = N + 1;

    // Copy active raw values into scratch, then insertion-sort
    // splitPoints ascending while carrying ranges in parallel.
    for (var i = 0; i < N; i++) {
        sortPts[i] = rawSplitPoints[i + 1];
        sortAbove[i] = rawRangeAbove[i + 1];
        sortBelow[i] = rawRangeBelow[i + 1];
    }
    for (var i = 1; i < N; i++) {
        var pt = sortPts[i];
        var ab = sortAbove[i];
        var bl = sortBelow[i];
        var j = i;
        while (j > 0 && sortPts[j - 1] > pt) {
            sortPts[j] = sortPts[j - 1];
            sortAbove[j] = sortAbove[j - 1];
            sortBelow[j] = sortBelow[j - 1];
            j--;
        }
        sortPts[j] = pt;
        sortAbove[j] = ab;
        sortBelow[j] = bl;
    }

    // Per-region claim bounds. Edge regions are unbounded.
    var lo = cache.lowerBounds;
    var hi = cache.upperBounds;
    lo.length = numRegions;
    hi.length = numRegions;
    lo[0] = -Infinity;
    hi[N] = Infinity;
    for (var i = 0; i < N; i++) {
        hi[i] = sortPts[i] + sortAbove[i];
        lo[i + 1] = sortPts[i] - sortBelow[i];
    }

    // Region channels and transposes, plus deduplicated failsafe set.
    var chs = cache.regionChannels;
    var trs = cache.regionTransposes;
    var failsafe = cache.failsafeChannels;
    chs.length = numRegions;
    trs.length = numRegions;
    failsafe.length = 0;
    for (var i = 0; i < numRegions; i++) {
        var ch = rawRegionChannels[i + 1];
        chs[i] = ch;
        trs[i] = rawRegionTransposes[i + 1];
        var seen = false;
        for (var j = 0; j < failsafe.length; j++) {
            if (failsafe[j] === ch) { seen = true; break; }
        }
        if (!seen) failsafe.push(ch);
    }
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
            cache.lowerBounds,
            cache.upperBounds,
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
