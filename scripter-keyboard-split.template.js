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
// (replaced by build.js with the contents of split-router.js)
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
