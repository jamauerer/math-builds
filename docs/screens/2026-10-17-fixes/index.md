# 2026-10-17 fixes

Played one challenge in every family. Each test ran on the family's own scene, the progress value moved, and the result appeared only after those frames.

| File | What it shows |
| --- | --- |
| test-bridge-mid.png | Stick bridge, Test step, car mid-span, flag on the right, ruler 0 and 4. |
| test-lever-mid.png | Seesaw, Test step, plank and both loads, ruler 0 and 8. |
| test-gears-mid.png | Gear board, Test step, two meshing gears turning, ruler 0 and 24. |
| world-picker.png | One card per family, that family's drawing, tiles by state. |
| calculate.png | Measure column: question, drawing pad, then the 1 2 3 keypad, not under the pad. |

At an emulated 1024x768 the pad ended at y 420 and the keypad started at y 428. Keys 1, 2, and 3 sat on one row (x 692, 801, and 911) and none were past the viewport. The page did not scroll. The same row contract is what the layout test checks at 768, 820, and 900.
