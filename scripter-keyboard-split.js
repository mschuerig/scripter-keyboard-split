/**
 * scripter-keyboard-split — MainStage / Logic Pro Scripter plugin
 *
 * Splits incoming MIDI notes between two MIDI channels using either a
 * fixed split point or a smart floating split that tracks each region's
 * most recent note independently. Designed around the IK Multimedia
 * Hammond plugin and similar two-channel split workflows.
 *
 * This file is GENERATED. The routing logic block between the
 * @inject:split-router markers comes from split-router.js. To edit the
 * routing algorithm, change split-router.js and run `bun run build`.
 */

var PluginParameters = [
    {
        name: "Split Mode",
        type: "menu",
        valueStrings: ["Fixed", "Floating"],
        defaultValue: 1
    },
    {
        name: "Base Split Point",
        type: "lin",
        minValue: 0,
        maxValue: 127,
        numberOfSteps: 127,
        defaultValue: 60
    },
    {
        name: "Floating Range Above",
        type: "lin",
        minValue: 0,
        maxValue: 12,
        numberOfSteps: 12,
        defaultValue: 3
    },
    {
        name: "Floating Range Below",
        type: "lin",
        minValue: 0,
        maxValue: 12,
        numberOfSteps: 12,
        defaultValue: 3
    },
    {
        name: "Upper Region Channel",
        type: "lin",
        minValue: 1,
        maxValue: 16,
        numberOfSteps: 15,
        defaultValue: 1
    },
    {
        name: "Lower Region Channel",
        type: "lin",
        minValue: 1,
        maxValue: 16,
        numberOfSteps: 15,
        defaultValue: 2
    },
    {
        name: "Upper Region Transpose",
        type: "lin",
        minValue: -4,
        maxValue: 4,
        numberOfSteps: 8,
        defaultValue: 0
    },
    {
        name: "Lower Region Transpose",
        type: "lin",
        minValue: -4,
        maxValue: 4,
        numberOfSteps: 8,
        defaultValue: 0
    }
];

var lastPitchUpper = null;
var lastPitchLower = null;

var noteToChannel = [];
for (var i = 0; i < 128; i++) {
    noteToChannel[i] = null;
}

// @inject:split-router
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
function routeNote(input) {
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
function transposeByOctaves(pitch, octaves) {
    return Math.max(0, Math.min(127, pitch + octaves * 12));
}
// @end-inject

function HandleMIDI(event) {
    if (event instanceof NoteOn) {
        var splitMode = GetParameter("Split Mode");
        var baseSplit = GetParameter("Base Split Point");
        var floatingRangeAbove = GetParameter("Floating Range Above");
        var floatingRangeBelow = GetParameter("Floating Range Below");
        var upperChannel = GetParameter("Upper Region Channel");
        var lowerChannel = GetParameter("Lower Region Channel");
        var upperTranspose = GetParameter("Upper Region Transpose");
        var lowerTranspose = GetParameter("Lower Region Transpose");

        var originalPitch = event.pitch;

        var route = routeNote({
            pitch: originalPitch,
            lastPitchUpper: lastPitchUpper,
            lastPitchLower: lastPitchLower,
            baseSplit: baseSplit,
            floatingRangeAbove: floatingRangeAbove,
            floatingRangeBelow: floatingRangeBelow,
            splitMode: splitMode
        });

        lastPitchUpper = route.newLastPitchUpper;
        lastPitchLower = route.newLastPitchLower;

        var targetChannel;
        if (route.channel === 1) {
            targetChannel = upperChannel;
            event.pitch = transposeByOctaves(originalPitch, upperTranspose);
        } else {
            targetChannel = lowerChannel;
            event.pitch = transposeByOctaves(originalPitch, lowerTranspose);
        }

        noteToChannel[originalPitch] = targetChannel;
        event.channel = targetChannel;
    }
    else if (event instanceof NoteOff) {
        var recordedChannel = noteToChannel[event.pitch];

        if (recordedChannel !== null && recordedChannel !== undefined) {
            event.channel = recordedChannel;
            event.send();
            noteToChannel[event.pitch] = null;
        } else {
            // Failsafe: a NoteOff arrived with no recorded NoteOn channel
            // (e.g. script was started mid-note). Send to both channels
            // so nothing hangs.
            var upperCh = GetParameter("Upper Region Channel");
            var lowerCh = GetParameter("Lower Region Channel");
            event.channel = upperCh;
            event.send();
            event.channel = lowerCh;
            event.send();
        }
        return;
    }

    event.send();
}
