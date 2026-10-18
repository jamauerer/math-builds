# Level authoring

Two rules govern every machine, present and future.

## Rule 1: The build always does a job

No machine is ever a mechanism on its own. The gears are the inside of a winch, a clock, or a bike. The lever is a seesaw, a wheelbarrow, or a drawbridge. The bridge always carries a real vehicle with a weight.

The mission names the job in plain words. Example: "Lift the 20 kg bucket out of the well with a crank a kid can turn."

The output object is visible in the scene from Measure on. The Test step shows the job being done or failing. A challenge with no output object fails the build.

## Rule 2: Thirteen levels per machine, same machine

Every machine has a ladder of 13 levels. The levels loosely follow kindergarten through grade 12, and they are opened by placement. They are never opened by age or grade, and they are never labeled with a grade.

The board, the parts, and the physics are the same at every level. Each level turns five dials one notch:

- Numbers: counting, whole, fractions, ratios, decimals, variables, functions.
- Representation: objects to count, labeled pictures, symbols, graphs.
- Given versus found: level 1 shows the answer and the learner watches. Level 13 designs under constraints and the app only checks.
- Design freedom: snap one part, pick from two, build a stage, lay out the whole machine.
- Precision and units: none, blocks, units, decimals, rates, radians.

Each level has at least 3 challenges with different numbers, a predict question, and an output object for the job.

Store each ladder as data in `src/machines/<name>/ladder.json`. Render it to `docs/ladders/<name>.md`.

Dial values on a ladder are non-decreasing. A later level does not turn a dial backward.
