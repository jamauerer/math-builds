# Candy Land screen fix, 2026-10-17

Checked in the dev server at http://localhost:5174/ with the viewport set to 1180x820, 1440x900, and 1024x768.

## What the page did

At every size, `document.documentElement.scrollHeight` matched the viewport height on the world picker and on Measure, Earn parts, Build, and Drive. Buttons, including Settings, stayed inside the viewport. The build-flow screens show one Worlds button, the four-step bar, and Settings. Count, Calculate, Free build, and the Candy, Wood, and Steel themes are inside Settings.

Earn parts shows the question in dark type above the pad. Measured ink on the pad was rgb(28, 25, 23) on rgb(255, 247, 234). The pad is for writing. The keypad stayed on screen at 1024x768 (pad bottom 731 of 768) and at 1440x900 (pad bottom 863 of 900).

Level 1: counted 4 blocks, answered both part questions, dragged chocolate bars and a candy cane into the gap, and drove. The line on screen was "Watch the car." and only after that "The car crossed. This bridge is complete." with Next level and Try again. A bridge with the middle blocks removed ended on "A block is missing from the gap. Fill every block." with the car in the gap. Tapping a placed bar put it back in the tray and raised the count.

Level 2: the gap question is "How many meters is the gap?" The part questions name the meters and the kilograms. The tray started at 5 chocolate bars, 2 candy cane pillars, and 1 wafer. Dragging 4 bars and 2 pillars, then Drive, ended on "The car crossed. This bridge is complete."

The world picker stays ability-based. Candy Land levels 1 and 2 show done. Locked worlds say what skill opens them. The optional control is "Set age".

## Screenshots

Files are named by screen and viewport. `drive-fail-1180.png` is the held last frame of a failed drive. `drive-l2-1180.png` is level 2 after the car crossed. `build-live.png` and `build-two-pieces-live.png` are single-layout captures from the IDE browser (the pane crops the right edge). The other PNGs are full-viewport captures. In those full-viewport files the picture can look repeated side by side; the DOM at the same moment had one root, one Worlds button, and an app the width of the viewport.

A separate frozen frame from the middle of a finger drag was not saved. The drag gesture finishes before a screenshot can land between pickup and drop. `build-two-pieces-live.png` is the build screen after two bars were dragged in, with the tray count at 3.
