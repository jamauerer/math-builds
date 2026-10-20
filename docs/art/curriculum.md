# Math Builds curriculum

This file is the source of truth for the skill graph. Every skill listed here must exist in the app with a generator, a Learn card, an explanation template and at least one practice generator. Nothing is served to a learner that is not in this file.

## How to read it

- Levels run 1 to 13. A level is roughly one US school year, but placement puts a learner where they are, not where their grade says.
- Grades, US: L1 K, L2 1st, L3 2nd, L4 3rd, L5 4th, L6 5th, L7 6th, L8 7th, L9 8th, L10 Algebra I (9th), L11 Geometry (10th), L12 Algebra II (11th), L13 Precalculus (12th).
- Grades, Europe (Germany, Austria, Switzerland, Netherlands, Scandinavia, "Klasse"): L1 preschool or Vorschule, L2 Klasse 1, L3 Klasse 2, L4 Klasse 3, L5 Klasse 4, L6 Klasse 5, L7 Klasse 6, L8 Klasse 7, L9 Klasse 8, L10 Klasse 9, L11 Klasse 10, L12 Klasse 11, L13 Klasse 12 and 13. European Klasse 4 already does written division (dividing.6.long) and Klasse 6 does fractions through adding.7.fractions-unlike, so a European placement starts one level higher than the Klasse map says for dividing and fractions from Klasse 4 on; the staircase settles it from there.
- The grade pick shows the system that matches the units setting: US grades with US units, Klasse 1 to 13 with metric. Either can be switched on the profile. The system only sets where placement starts; the levels and skills are the same for everyone.
- Strands: counting, adding (includes subtracting), multiplying, dividing, fractions (includes decimals), ratios (includes percent), measuring, geometry, algebra. A strand does not have a skill at every level; the table says where it starts and where it hands over.
- Skill id: `strand.level.short-name`. Stable, never renamed.
- Notation: how the plain question is written. Plain questions use this exact form. Word problems and pictures are separate and follow the picture rules in the app.
- Answer: whole, decimal (1 place unless stated), fraction (a/b), expression, or choice (tap one of several).
- Learn picture: what the Learn card and the explanation draw. Dots, bolts, planks, beams and the tape measure are the kit's own sprites.
- Kit use: which kit piece or question draws on it today. Blank means practice only for now.
- Prereq: skills that must be at least "learning" before this one is offered as new.

The three arithmetic strands (adding, multiplying, dividing) are the spine. No other strand may sit more than one level above the lowest of these three until they are mastered at that level.

## Counting

| Level | Skill id | Skill | Notation | Answer | Learn picture | Kit use | Prereq |
|---|---|---|---|---|---|---|---|
| 1 | counting.1.to-10 | Count to 10 | "How many?" with 1 to 10 bolts | whole | bolts in a row | gussets, bolts | |
| 1 | counting.1.compare | More or fewer | "Which has more?" two groups, tap one | choice | two rows of bolts | | counting.1.to-10 |
| 1 | counting.1.numerals | Read a number | "Tap 7" from 0 to 10 | choice | numerals with dots under them | | |
| 2 | counting.2.to-100 | Count to 100 | "How many?" with bolts in rows of 10 | whole | rows of 10 bolts | bolts | counting.1.to-10 |
| 2 | counting.2.skip-2-5-10 | Skip count by 2, 5, 10 | "2, 4, 6, ?, 10" | whole | bolts in pairs, hands of 5, rows of 10 | planks | counting.2.to-100 |
| 2 | counting.2.place-value | Tens and ones | "47 = ? tens and ? ones" | whole | bundles of 10 planks and loose planks | | counting.2.to-100 |
| 3 | counting.3.to-1000 | Numbers to 1000 | "Tap the bigger number: 348 or 384" | choice | hundreds squares, tens rods, ones | | counting.2.place-value |
| 3 | counting.3.round-10 | Round to the nearest 10 | "Round 47 to the nearest 10" | whole | tape measure with 40 and 50 marked | measuring the gap | counting.2.place-value |
| 4 | counting.4.round-100 | Round to the nearest 100 or 1000 | "Round 2,348 to the nearest 100" | whole | number line with 2300 and 2400 | | counting.3.round-10 |
| 4 | counting.4.even-odd | Even and odd | "Is 37 even or odd?" | choice | bolts paired up with one left over | | counting.2.skip-2-5-10 |
| 5 | counting.5.factors | Factors and multiples | "List the factors of 12" or "Is 24 a multiple of 6?" | choice | 12 bolts arranged as 1x12, 2x6, 3x4 | | multiplying.4.tables-10 |
| 5 | counting.5.primes | Prime or not | "Is 17 prime?" | choice | bolts that only make one row | | counting.5.factors |
| 6 | counting.6.negatives | Negative numbers on a line | "Which is colder, -3 or -7?" | choice | thermometer and number line through zero | | counting.3.to-1000 |
| 7 | counting.7.integers-add | Add and subtract integers | "-3 + 8 = ?" and "4 - 9 = ?" | whole | number line jumps left and right | | counting.6.negatives |
| 8 | counting.8.integers-multiply | Multiply and divide integers | "-3 x 4 = ?" and "-12 / -3 = ?" | whole | sign rule table | | counting.7.integers-add |
| 9 | counting.9.exponents | Powers and roots | "2^5 = ?" and "sqrt(81) = ?" | whole | squares of dots: 1, 4, 9, 16 | brace at level 9 | multiplying.5.multi-digit |
| 10 | counting.10.scientific | Scientific notation | "Write 4,500 as a x 10^n" | expression | place value sliding | | counting.9.exponents |

Counting hands over to algebra at level 10.

## Adding (and subtracting)

| Level | Skill id | Skill | Notation | Answer | Learn picture | Kit use | Prereq |
|---|---|---|---|---|---|---|---|
| 1 | adding.1.to-5 | Add within 5 | "2 + 3 = ?" | whole | two groups of bolts pushed together | | counting.1.to-10 |
| 1 | adding.1.take-away-5 | Take away within 5 | "5 - 2 = ?" | whole | bolts, some crossed out | | adding.1.to-5 |
| 2 | adding.2.to-20 | Add within 20 | "8 + 7 = ?" | whole | make a ten: 8 + 2, then 5 more | top beam word problem (posts at 2 and 6) | adding.1.to-5 |
| 2 | adding.2.subtract-20 | Subtract within 20 | "15 - 9 = ?" | whole | count back on the tape, or count up from 9 | | adding.2.to-20 |
| 2 | adding.2.missing | Missing number | "6 + ? = 13" | whole | balance scale with bolts | | adding.2.to-20 |
| 3 | adding.3.to-100 | Add within 100 | "47 + 36 = ?" | whole | tens and ones added separately | | adding.2.to-20, counting.2.place-value |
| 3 | adding.3.subtract-100 | Subtract within 100 | "82 - 47 = ?" | whole | borrowing shown with a rod broken into ones | | adding.3.to-100 |
| 3 | adding.3.three-numbers | Add three numbers | "4 + 9 + 6 = ?" | whole | pairs that make 10 found first | gussets plus bolts | adding.2.to-20 |
| 4 | adding.4.to-1000 | Add and subtract within 1000 | "358 + 467 = ?" and "703 - 258 = ?" | whole | column addition with carries | | adding.3.to-100 |
| 4 | adding.4.estimate | Estimate a sum | "About how much is 298 + 403?" | choice | rounding both first | | counting.3.round-10 |
| 5 | adding.5.big-numbers | Add and subtract to 1,000,000 | "48,275 + 9,648 = ?" | whole | column method | | adding.4.to-1000 |
| 5 | adding.5.decimals-tenths | Add tenths | "3.4 + 2.8 = ?" | decimal | tape measure in tenths | brace at level 9 uses it | fractions.5.decimals-tenths |
| 6 | adding.6.decimals | Add and subtract decimals | "12.75 - 3.9 = ?" | decimal | line up the point | | adding.5.decimals-tenths |
| 6 | adding.6.fractions-like | Add fractions, same denominator | "3/8 + 2/8 = ?" | fraction | planks split in eighths | | fractions.4.unit |
| 7 | adding.7.fractions-unlike | Add fractions, different denominators | "1/2 + 1/3 = ?" | fraction | two planks resplit into sixths | | adding.6.fractions-like, multiplying.5.lcm |
| 7 | adding.7.mixed | Add mixed numbers | "2 1/4 + 1 3/4 = ?" | fraction or whole | whole planks and parts | | adding.7.fractions-unlike |
| 8 | adding.8.integers-mixed | Add positives and negatives with decimals | "-2.5 + 6.75 = ?" | decimal | number line | | counting.7.integers-add, adding.6.decimals |

Adding hands over to algebra at level 9.

## Multiplying

| Level | Skill id | Skill | Notation | Answer | Learn picture | Kit use | Prereq |
|---|---|---|---|---|---|---|---|
| 3 | multiplying.3.equal-groups | Equal groups as repeated adding | "3 x 4 = ?" with 3 rows of 4 shown | whole | 3 rows of 4 bolts | bolts: 2 per gusset | adding.2.to-20 |
| 3 | multiplying.3.doubles | Times 2 | "2 x 7 = ?" | whole | pairs | | multiplying.3.equal-groups |
| 4 | multiplying.4.tables-5 | Times tables to 5 | "4 x 5 = ?" | whole | rows of bolts | bolts | multiplying.3.equal-groups |
| 4 | multiplying.4.tables-10 | Times tables to 10 | "7 x 8 = ?" | whole | rows of bolts, the 10x10 grid | planks: 8 planks 1 ft wide | multiplying.4.tables-5 |
| 4 | multiplying.4.by-10-100 | Multiply by 10 and 100 | "34 x 10 = ?" | whole | digits slide left | | multiplying.4.tables-10 |
| 5 | multiplying.5.two-by-one | Two-digit by one-digit | "47 x 6 = ?" | whole | 40 x 6 and 7 x 6 added | beam weight: 12 lb per ft x length | multiplying.4.tables-10 |
| 5 | multiplying.5.multi-digit | Multi-digit | "123 x 45 = ?" | whole | area model, four boxes | | multiplying.5.two-by-one |
| 5 | multiplying.5.lcm | Least common multiple | "LCM of 4 and 6 = ?" | whole | two skip count rows meeting | | counting.5.factors |
| 6 | multiplying.6.decimals | Multiply decimals | "2.5 x 4 = ?" and "1.2 x 0.3 = ?" | decimal | area model with tenths | | multiplying.5.two-by-one, fractions.5.decimals-tenths |
| 6 | multiplying.6.fractions | Multiply fractions | "2/3 x 3/4 = ?" | fraction | a plank cut two ways | | fractions.4.unit |
| 7 | multiplying.7.mixed | Multiply mixed numbers and fractions by wholes | "1 1/2 x 4 = ?" | whole or fraction | whole planks and halves | | multiplying.6.fractions |
| 8 | multiplying.8.integers | Multiply integers and decimals with signs | "-1.5 x 4 = ?" | decimal | sign rule | | counting.8.integers-multiply |
| 9 | multiplying.9.exponent-rules | Exponent rules | "2^3 x 2^4 = 2^?" | whole | stacks of 2s | | counting.9.exponents |

Multiplying hands over to algebra at level 10.

## Dividing

| Level | Skill id | Skill | Notation | Answer | Learn picture | Kit use | Prereq |
|---|---|---|---|---|---|---|---|
| 3 | dividing.3.share | Share equally | "8 / 2 = ?" with 8 bolts in 2 rows | whole | bolts dealt into rows | bottom beams: 8 ft / 2 | multiplying.3.equal-groups |
| 4 | dividing.4.facts-5 | Division facts to 5 | "20 / 5 = ?" | whole | rows of bolts, count a row | | multiplying.4.tables-5 |
| 4 | dividing.4.facts-10 | Division facts to 10 | "56 / 8 = ?" | whole | rows of bolts | bottom beams, planks: 8 ft / 8 | multiplying.4.tables-10 |
| 4 | dividing.4.fact-families | Fact families | "7 x 6 = 42, so 42 / 6 = ?" | whole | the same rows read both ways | | dividing.4.facts-10 |
| 5 | dividing.5.remainders | Division with remainders | "47 / 5 = ? r ?" | whole, remainder | rows of bolts with leftovers | | dividing.4.facts-10 |
| 5 | dividing.5.by-10-100 | Divide by 10 and 100 | "340 / 10 = ?" | whole | digits slide right | | multiplying.4.by-10-100 |
| 6 | dividing.6.long | Long division | "936 / 4 = ?" | whole | the four steps, one at a time | | dividing.5.remainders |
| 6 | dividing.6.decimals | Divide to a decimal | "7 / 2 = ?" and "4.8 / 4 = ?" | decimal | tape measure in tenths | brace at level 9: 5.66 / 2 | dividing.6.long, fractions.5.decimals-tenths |
| 7 | dividing.7.fractions | Divide by a fraction | "3 / (1/2) = ?" and "2/3 / 4 = ?" | whole or fraction | how many halves fit in 3 planks | | multiplying.6.fractions |
| 7 | dividing.7.gcf | Greatest common factor | "GCF of 24 and 36 = ?" | whole | factor rows | | counting.5.factors |
| 8 | dividing.8.integers | Divide integers and decimals with signs | "-15 / 2.5 = ?" | decimal | sign rule | | counting.8.integers-multiply |

Dividing hands over to algebra at level 9.

## Fractions (and decimals)

| Level | Skill id | Skill | Notation | Answer | Learn picture | Kit use | Prereq |
|---|---|---|---|---|---|---|---|
| 2 | fractions.2.halves | Halves and quarters | "Tap the plank cut in half" | choice | planks cut in 2 and 4 | | counting.1.to-10 |
| 3 | fractions.3.name | Name a fraction | "What part is colored?" | fraction | plank in thirds, 2 colored | planks: 3 of 8 laid | fractions.2.halves |
| 4 | fractions.4.unit | Unit fractions on a line | "Where is 1/4 on the tape?" | choice | tape measure split in 4 | | fractions.3.name |
| 4 | fractions.4.equivalent | Equivalent fractions | "2/4 = ?/8" | whole | one plank, two cuts | | fractions.4.unit |
| 4 | fractions.4.compare | Compare fractions | "Which is bigger, 2/3 or 3/5?" | choice | two planks side by side | | fractions.4.equivalent |
| 5 | fractions.5.of-a-number | Fraction of a number | "3/4 of 12 = ?" | whole | 12 planks, 9 colored | planks laid | dividing.4.facts-10 |
| 5 | fractions.5.decimals-tenths | Tenths and hundredths as decimals | "3/10 = 0.?" | decimal | tape measure in tenths | | fractions.4.unit |
| 5 | fractions.5.simplify | Simplify a fraction | "6/8 = ?" | fraction | regroup the cuts | | dividing.7.gcf or counting.5.factors |
| 6 | fractions.6.to-decimal | Fraction to decimal | "3/4 = 0.?" | decimal | 3/4 of a tape in hundredths | | dividing.6.decimals |
| 6 | fractions.6.improper | Improper and mixed | "7/4 = 1 ?/4" | fraction | one whole plank and 3 quarters | | fractions.4.unit |
| 7 | fractions.7.decimal-compare | Order decimals and fractions | "Order 0.6, 2/3, 0.65" | choice | all on one tape | | fractions.6.to-decimal |
| 8 | fractions.8.repeating | Repeating decimals | "1/3 = 0.?" | decimal | long division that never ends | | dividing.6.decimals |

Fractions hand over to ratios and algebra at level 8.

## Ratios (and percent)

| Level | Skill id | Skill | Notation | Answer | Learn picture | Kit use | Prereq |
|---|---|---|---|---|---|---|---|
| 6 | ratios.6.write | Write a ratio | "3 bolts for every 2 planks: 3:2. 9 bolts, how many planks?" | whole | rows of bolts and planks | bolts per gusset | multiplying.4.tables-10 |
| 6 | ratios.6.unit-rate | Unit rate | "12 lb for 4 ft, how many lb per ft?" | whole | beam split in 4 | beam weight per ft | dividing.4.facts-10 |
| 7 | ratios.7.percent | Percent of a number | "25% of 80 = ?" | whole | 100 bolts, 25 colored | load meter: 40 lb of 180 | fractions.5.of-a-number |
| 7 | ratios.7.scale | Scale drawings | "1 cm on the plan = 2 ft. 4 cm = ? ft" | whole | blueprint next to bridge | blueprint | ratios.6.unit-rate |
| 7 | ratios.7.proportion | Solve a proportion | "3/4 = x/12" | whole | two equal plank splits | teeter totter counterweights | fractions.4.equivalent |
| 8 | ratios.8.percent-change | Percent increase and decrease | "80 lb up 25% = ?" | whole | load meter growing | heavy goat: 40 lb to 80 lb | ratios.7.percent |
| 8 | ratios.8.rates | Speed, distance, time | "1 ft per second for 8 ft = ? s" | whole | goat on the tape with a clock | goat crossing time | ratios.6.unit-rate |
| 9 | ratios.9.slope | Slope as rise over run | "Rise 3, run 12, slope = ?" | fraction or decimal | ramp drawn on a grid | mountain ramp | ratios.7.proportion |
| 10 | ratios.10.similar | Similar triangles | "Triangles are similar, 3:4 and 6:?" | whole | two braces, small and large | | ratios.7.proportion, geometry.8.triangles |

Ratios hand over to algebra and geometry at level 10.

## Measuring

| Level | Skill id | Skill | Notation | Answer | Learn picture | Kit use | Prereq |
|---|---|---|---|---|---|---|---|
| 1 | measuring.1.longer | Longer or shorter | "Which beam is longer?" | choice | two beams | pre-cut pieces | |
| 2 | measuring.2.units | Measure with a tape | "How long is the beam?" with the tape under it | whole | tape measure, whole units | every length in Assemble | counting.1.to-10 |
| 2 | measuring.2.gap | Length between two marks | "Posts at 2 and 6. How far apart?" | whole | two posts on the tape | top beam | adding.2.subtract-20 |
| 3 | measuring.3.perimeter | Perimeter | "Sides 3, 4, 3, 4. Perimeter = ?" | whole | railing around a deck | railing: both sides of 8 ft | adding.3.three-numbers |
| 3 | measuring.3.weight | Weight in lb or kg | "Which is heavier?" and "40 lb + 40 lb = ?" | whole | goat on a scale | load meter | adding.3.to-100 |
| 4 | measuring.4.area | Area of a rectangle | "4 by 6 = ? square ft" | whole | planks laid in a grid | deck area | multiplying.4.tables-10 |
| 4 | measuring.4.convert | Convert units | "3 ft = ? in" or "2 m = ? cm" | whole | tape with both scales | US and metric toggle | multiplying.4.by-10-100 |
| 5 | measuring.5.decimal-length | Lengths to a tenth | "2.8 ft on the tape" | decimal | tape in tenths | brace 2.83 | fractions.5.decimals-tenths |
| 5 | measuring.5.time | Elapsed time | "Started at 2:45, took 35 min, ends at ?" | choice | clock | | adding.3.to-100 |
| 6 | measuring.6.volume | Volume of a box | "3 x 4 x 2 = ? cubic ft" | whole | stacked bricks | abutments | measuring.4.area |
| 6 | measuring.6.angles | Measure an angle | "What angle is the brace?" | choice | protractor on the truss | braces | geometry.4.angles-names |
| 7 | measuring.7.circles | Circumference and area of a circle | "Radius 2, circumference = ?" | decimal | a wheel rolled out on the tape | bicycle, gears | multiplying.6.decimals |
| 8 | measuring.8.compound | Area of compound shapes | "L shape made of two rectangles" | whole | deck plus landing | | measuring.4.area |

Measuring hands over to geometry at level 9.

## Geometry

| Level | Skill id | Skill | Notation | Answer | Learn picture | Kit use | Prereq |
|---|---|---|---|---|---|---|---|
| 1 | geometry.1.shapes | Name a shape | "Tap the triangle" | choice | shapes made of beams | | |
| 2 | geometry.2.sides | Count sides and corners | "How many corners?" | whole | a gusset plate, a truss panel | gussets at corners | counting.1.to-10 |
| 3 | geometry.3.triangles-count | Count the triangles | "How many triangles in the truss?" | whole | the truss | brace at level 3 | geometry.1.shapes |
| 4 | geometry.4.angles-names | Right, acute, obtuse | "Is this angle right, acute or obtuse?" | choice | brace against post | brace | geometry.2.sides |
| 4 | geometry.4.symmetry | Lines of symmetry | "Tap the line of symmetry" | choice | the truss, folded | | geometry.1.shapes |
| 5 | geometry.5.longest-side | Longest side of a right triangle | "Which is longer, the brace or the post?" | choice | brace, post, beam as a triangle | brace at level 5 | geometry.4.angles-names |
| 6 | geometry.6.angle-sum | Angles in a triangle add to 180 | "Two angles are 90 and 45. The third = ?" | whole | the brace triangle | brace at level 6 | measuring.6.angles |
| 7 | geometry.7.coordinates | Points on a grid | "Which point is (3, 2)?" | choice | truss nodes on a grid | blueprint nodes | counting.6.negatives |
| 8 | geometry.8.triangles | Triangle types and congruence | "Are these two braces the same triangle?" | choice | two braces mirrored | braces | geometry.6.angle-sum |
| 9 | geometry.9.pythagoras | Pythagoras | "Legs 3 and 4. Hypotenuse = ?" | decimal (1 place) or whole | real squares drawn on each leg | brace at level 9: sqrt(2^2 + 2^2) | counting.9.exponents |
| 9 | geometry.9.distance | Distance between two points | "(0,0) to (6,8) = ?" | whole or decimal | triangle under the line | | geometry.9.pythagoras, geometry.7.coordinates |
| 10 | geometry.10.area-triangle | Area of a triangle and trapezoid | "Base 8, height 2, area = ?" | whole | truss panel | truss panel | measuring.4.area |
| 11 | geometry.11.trig-ratios | Sine, cosine, tangent | "tan(45) = ?" and "The brace makes 45 degrees with a 2 ft run. Rise = ?" | decimal | brace triangle with the angle marked | brace at level 11 | geometry.9.pythagoras |
| 11 | geometry.11.proofs | Why it holds | "Which fact proves the braces are equal?" | choice | two triangles with marks | | geometry.8.triangles |
| 12 | geometry.12.circles | Arcs and sectors | "Angle 90 of radius 4, arc length = ?" | decimal | gear tooth arc | gears | measuring.7.circles |
| 13 | geometry.13.vectors | Forces as vectors | "Push 30 at 45 degrees, horizontal part = ?" | decimal | force arrows on the truss | who is working hardest | geometry.11.trig-ratios |

## Algebra

| Level | Skill id | Skill | Notation | Answer | Learn picture | Kit use | Prereq |
|---|---|---|---|---|---|---|---|
| 6 | algebra.6.unknown | A letter for a number | "x + 5 = 12, x = ?" | whole | balance scale with bolts | top beam as x | adding.2.missing |
| 6 | algebra.6.patterns | Continue a pattern | "3, 7, 11, 15, ?" | whole | planks laid in a growing pattern | | counting.2.skip-2-5-10 |
| 7 | algebra.7.one-step | One-step equations | "4x = 28" and "x - 9 = 15" | whole | balance, same move on both sides | | algebra.6.unknown |
| 7 | algebra.7.expressions | Evaluate an expression | "2x + 3 when x = 5" | whole | substitute the bolt count | | algebra.6.unknown |
| 8 | algebra.8.two-step | Two-step equations | "2x + 3 = 11, x = ?" | whole | balance in two moves | brace length as x | algebra.7.one-step |
| 8 | algebra.8.inequalities | Inequalities | "Which x make 3x < 12?" | choice | number line shaded | load limit: 40x < 180 | algebra.7.one-step |
| 9 | algebra.9.linear | y = mx + b | "y = 2x + 1. When x = 4, y = ?" | whole | ramp line on a grid | ramp | algebra.7.expressions, ratios.9.slope |
| 9 | algebra.9.graph-line | Read a line from a graph | "What is the slope of this line?" | fraction or decimal | grid with the ramp | ramp | algebra.9.linear |
| 10 | algebra.10.systems | Two equations, two unknowns | "x + y = 10, x - y = 2" | whole pair | two lines crossing | teeter totter: two weights | algebra.9.linear |
| 10 | algebra.10.distribute | Distribute and factor | "3(x + 4) = ?" and "6x + 9 = 3(?)" | expression | area model | | algebra.8.two-step |
| 11 | algebra.11.quadratics | Quadratics | "x^2 - 5x + 6 = 0, x = ?" | whole pair | parabola, the catapult arc | catapult | algebra.10.distribute, counting.9.exponents |
| 11 | algebra.11.functions | Function notation | "f(x) = x^2 + 1, f(3) = ?" | whole | input and output machine | | algebra.7.expressions |
| 12 | algebra.12.exponential | Exponential growth | "Doubles every hour, 5 at start, after 4 hours = ?" | whole | doubling bolts | | algebra.11.functions |
| 12 | algebra.12.rational | Rational expressions | "Simplify (x^2 - 9)/(x - 3)" | expression | factor and cancel | | algebra.10.distribute |
| 13 | algebra.13.trig-functions | Trig functions and radians | "sin(pi/6) = ?" | fraction or decimal | unit circle as a wheel | bicycle crank | geometry.11.trig-ratios |
| 13 | algebra.13.sequences | Sequences and sums | "Sum of 1 to 100 = ?" | whole | planks stacked in a staircase | | algebra.6.patterns |

## Kit pieces and the strands they draw on

| Kit piece | Strand | Question type at each level |
|---|---|---|
| Bottom beams | dividing | share equally (3), facts (4), decimals (6), x in an equation (8) |
| Posts | measuring | measure with the tape (2), convert units (4), decimal length (5) |
| Top beam | adding | difference of two marks (2), to 100 (3), decimals (6), x (6 and up) |
| Braces | geometry | count triangles (3), angle names (4), longest side (5), angle sum (6), Pythagoras (9), trig (11) |
| Gussets | counting | count to 10 (1), corners (2), factors (5) |
| Bolts | multiplying | equal groups (3), tables (4), two-digit (5), ratio (6) |
| Planks | fractions | halves (2), name (3), fraction of a number (5), area of the deck (measuring 4) |
| Railing | measuring | perimeter (3), compound area (8) |
| Heavy goat | ratios | percent (7), percent change (8), inequality (algebra 8) |

## Rules the app enforces from this file

1. Every skill id here has a generator, a Learn card and an explanation template. A test lists the skill ids in this file and fails on any that are missing in code, and on any skill in code that is not in this file.
2. Notation in plain questions matches the Notation column exactly in form.
3. A skill is offered as new only when its prereqs are at least "learning".
4. The arithmetic spine rule from the top of this file.
5. Grade to starting level for placement. US: K 1, 1st 2, 2nd 3, 3rd 4, 4th 5, 5th 6, 6th 7, 7th 8, 8th 9, 9th 10, 10th 11, 11th 12, 12th 13. Europe: Vorschule 1, Klasse 1 is 2, Klasse 2 is 3, and so on to Klasse 12 is 13; Klasse 13 is 13. From Klasse 4 on, dividing and fractions start one level higher. Placement moves from there.
6. The grade pick offers the system matching the units setting (US grades with US units, Klasse with metric) and lets the learner switch.
