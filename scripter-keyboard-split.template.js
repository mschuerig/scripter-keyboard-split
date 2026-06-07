/**
 * scripter-keyboard-split — MainStage / Logic Pro Scripter plugin
 *
 * Version: 0.1.1
 * This version: https://github.com/mschuerig/scripter-keyboard-split/blob/v0.1.1/scripter-keyboard-split.js
 * Latest version: https://github.com/mschuerig/scripter-keyboard-split/blob/main/scripter-keyboard-split.js
 * Project home: https://github.com/mschuerig/scripter-keyboard-split
 *
 * Splits the keyboard between up to MAX_SPLITS + 1 MIDI channels.
 * Each split has Floating Range Above / Below knobs that govern how
 * far the adjacent zones extend past the split. Set both ranges of
 * a split to 0 for a hard, fixed boundary; nonzero ranges let each
 * zone claim a band of pitches past the split and hold onto notes
 * that briefly cross over.
 *
 * Zone 1 is the highest zone of the keyboard — typically the
 * upper manual or the right-hand melody — and Zone N+1 the lowest.
 * Split Point i is the boundary between Zone i and Zone i+1.
 * The parameter list reads top-of-keyboard at the top — Zone 1,
 * Split 1, Zone 2, Split 2, … — so adjusting Number of Splits
 * reveals or hides rows at the bottom of the list (= bottom of the
 * keyboard) without shifting the rest.
 *
 * Hot-path discipline: HandleMIDI reads only the pre-computed
 * cache. rebuildCache is the only function that mutates routing
 * state, and it does so in place — sorting via scratch arrays
 * allocated once at script load, and computing per-zone claim
 * bounds (cache.lowerBounds / cache.upperBounds) so the router
 * doesn't have to do any arithmetic per event.
 *
 * This file is GENERATED. The routing logic block between the
 * @inject:split-router markers comes from split-router.js. To edit the
 * routing algorithm, change split-router.js and run `bun run build`.
 */

var MAX_SPLITS = 3;
var MAX_ZONES = MAX_SPLITS + 1;

var DEFAULT_NUM_SPLITS = 1;
var DEFAULT_SPLIT_POINT = 60;
var DEFAULT_RANGE_ABOVE = 3;
var DEFAULT_RANGE_BELOW = 3;
// Zone channels default to R_i = i. Zone 1 is the topmost zone
// (typically the upper manual or the main melody hand on a Hammond)
// and conventionally lives on MIDI channel 1.
var DEFAULT_ZONE_CHANNELS = [null, 1, 2, 3, 4];
var DEFAULT_ZONE_TRANSPOSE = 0;

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
            ? "1 split (2 zones)"
            : i + " splits (" + (i + 1) + " zones)"
    );
}
addParam({
    name: "Number of Splits",
    type: "menu",
    valueStrings: NUM_SPLITS_LABELS,
    defaultValue: DEFAULT_NUM_SPLITS - 1
}, { kind: "numSplits" });

for (var slot = 1; slot <= MAX_ZONES; slot++) {
    addParam({
        name: "Zone " + slot + " Channel",
        type: "lin",
        minValue: 1,
        maxValue: 16,
        numberOfSteps: 15,
        defaultValue: DEFAULT_ZONE_CHANNELS[slot]
    }, { kind: "channel", zoneIndex: slot });
    addParam({
        name: "Zone " + slot + " Transpose",
        type: "lin",
        minValue: -4,
        maxValue: 4,
        numberOfSteps: 8,
        defaultValue: DEFAULT_ZONE_TRANSPOSE
    }, { kind: "transpose", zoneIndex: slot });
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

// Raw parameter values keyed by 1-based split / zone index. Initialised
// from defaults so the cache is valid before any ParameterChanged fires.
var rawSplitPoints = [null];
var rawRangeAbove = [null];
var rawRangeBelow = [null];
for (var i = 1; i <= MAX_SPLITS; i++) {
    rawSplitPoints.push(DEFAULT_SPLIT_POINT);
    rawRangeAbove.push(DEFAULT_RANGE_ABOVE);
    rawRangeBelow.push(DEFAULT_RANGE_BELOW);
}
var rawZoneChannels = DEFAULT_ZONE_CHANNELS.slice();
var rawZoneTransposes = [null];
for (var i = 1; i <= MAX_ZONES; i++) {
    rawZoneTransposes.push(DEFAULT_ZONE_TRANSPOSE);
}

// Cache derived from raw values. HandleMIDI reads only this object.
// All arrays are reused in place by rebuildCache.
var cache = {
    numSplits: DEFAULT_NUM_SPLITS,
    lowerBounds: [],
    upperBounds: [],
    zoneChannels: [],
    zoneTransposes: [],
    failsafeChannels: []
};

// Scratch arrays for the in-place sort in rebuildCache. Allocated
// once at script load and reused on every rebuild.
var sortPts = new Array(MAX_SPLITS);
var sortAbove = new Array(MAX_SPLITS);
var sortBelow = new Array(MAX_SPLITS);

var lastPitches = new Array(MAX_ZONES);
for (var i = 0; i < MAX_ZONES; i++) lastPitches[i] = null;
var prevZone = -1;

// Parallel sparse arrays keyed by the controller's NoteOn pitch.
// On NoteOff we look up both the output channel and the (possibly
// transposed) output pitch so the synth gets a NoteOff that matches
// the NoteOn it heard. Without noteToPitch a transposed note hangs.
var noteToChannel = new Array(128);
var noteToPitch = new Array(128);
for (var i = 0; i < 128; i++) {
    noteToChannel[i] = null;
    noteToPitch[i] = null;
}

// @inject:split-router
// (replaced by build.js with the contents of split-router.js)
// @end-inject

function rebuildCache() {
    var N = cache.numSplits;
    var numZones = N + 1;

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

    // Per-zone claim bounds. Edge zones are unbounded. The split
    // point itself always belongs to the upper zone; with above = 0
    // (hard split) the lower zone's ceiling is split - 1 so the
    // boundary note can't be pulled into lower by the
    // follow-the-hand bias.
    var lo = cache.lowerBounds;
    var hi = cache.upperBounds;
    lo.length = numZones;
    hi.length = numZones;
    lo[0] = -Infinity;
    hi[N] = Infinity;
    for (var i = 0; i < N; i++) {
        hi[i] = sortAbove[i] > 0 ? sortPts[i] + sortAbove[i] : sortPts[i] - 1;
        lo[i + 1] = sortPts[i] - sortBelow[i];
    }

    // Zone channels and transposes, plus deduplicated failsafe set.
    // Router zone index i goes 0 (lowest pitch) to N (highest), but
    // the UI labels zones top-down: Zone 1 is the topmost (router
    // index N), Zone N+1 the bottommost (router index 0). Map raw
    // UI-keyed values into router-keyed slots accordingly.
    var chs = cache.zoneChannels;
    var trs = cache.zoneTransposes;
    var failsafe = cache.failsafeChannels;
    chs.length = numZones;
    trs.length = numZones;
    failsafe.length = 0;
    for (var i = 0; i < numZones; i++) {
        var uiLabel = numZones - i;
        var ch = rawZoneChannels[uiLabel];
        chs[i] = ch;
        trs[i] = rawZoneTransposes[uiLabel];
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
        else if (m.zoneIndex !== undefined) hide = m.zoneIndex > N + 1;
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
            rawZoneChannels[m.zoneIndex] = value;
            if (m.zoneIndex <= cache.numSplits + 1) rebuildCache();
            return;
        case "transpose":
            rawZoneTransposes[m.zoneIndex] = value;
            if (m.zoneIndex <= cache.numSplits + 1) rebuildCache();
            return;
    }
}

applyVisibility();
rebuildCache();

function HandleMIDI(event) {
    if (event instanceof NoteOn) {
        prevZone = routeNoteOn(event, cache, lastPitches, prevZone, noteToChannel, noteToPitch);
        event.send();
        return;
    }
    if (event instanceof NoteOff) {
        if (routeNoteOff(event, noteToChannel, noteToPitch)) {
            event.send();
        } else {
            // Failsafe: a NoteOff arrived with no recorded NoteOn pairing
            // (e.g. script started mid-note). Fan out to every active
            // zone channel so the note doesn't hang.
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
