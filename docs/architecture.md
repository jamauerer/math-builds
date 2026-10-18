# Adding a machine

A machine is a definition file plus one engineering model. The workshop, the loop, and the progress store stay shared.

## Modules

- `src/engine` wraps a planck world (`createWorld`, `stepWorld`, `runUntilSettled`) and defines `EngineeringModel`. Each model reports derived numbers, failures, and assumptions. The rigid-body scene animates the design. The model decides whether it is sound.
- `src/curriculum` holds the skill graph, mastery (challenge, transfer, next-day recall), and the hint ladder.
- `src/machines/<name>/definition.ts` is data: stages, questions, challenge families, stock, stars, and skills.
- `src/machines/<name>/model.ts` is the only machine-specific code, plus any custom piece drawing if a later machine needs it.
- `src/workshop` is one screen path: Measure, Calculate, Build, Test, Diagnose, Sandbox.
- `src/progress` exports and imports the saved JSON. Mastery, completed challenges, earned parts, and sandbox builds live on `SavedProgress.workshop`.

Register the machine in `src/machines/index.ts`.

## The loop

`src/machines/make.ts` builds three questions for each challenge: a measure read, a part question, and a predict question. A part question stores the typed number as the part spec, right or wrong. A predict question produces no part and must be submitted before Test. `piecesFor` puts that part, a spare of the correct spec on the first challenge of a family, a decoy, and the creative piece in the tray. A failed settle or a failed test returns every placed piece to the tray.

## The three machines

Bridge (`src/machines/bridge`) checks bearing length, beam count against the load, sag `load * span^3 / (4 * stiffness * depth^3)` against `span / 20`, bending stress `1.5 * load * span / depth^2` when a scene sets `stressLimit`, truss tension and compression, arch thrust, and hanger drop on a parabola. Short beams are welded only when they reach both cliffs, so a short beam falls in the planck scene.

Lever (`src/machines/lever`) checks moments `mass * distance`, the three classes through `load * loadArm / effortArm`, and a second lever whose advantages multiply. Loads are welded to the plank so the planck angle tips toward the larger moment.

Gears (`src/machines/gears`) mesh when the center distance is `r1 + r2` with `radius = teeth / 2`. Speed ratio is driving teeth over driven teeth. Direction flips at each mesh. Compound ratios multiply. Rotation uses revolute joints plus a gear joint. Tooth collision is not used.

## What is still thin

Truss challenges are tagged to rectangle area, gear direction to compare numbers, unknown mass to missing addend, and the cable parabola to a line through the origin. Those skills open the challenges. They are not the same mathematics. The curriculum map marks them. Clock challenge 3 grades the 60:1 minute train. The separate 12:1 hour prediction is not enforced by the gear model.
